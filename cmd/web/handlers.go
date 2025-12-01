package main

import (
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"

	"math"
	"net/http"

	"fullstack-project.jonnevuorela.com/internal/models"
	"fullstack-project.jonnevuorela.com/internal/validator"
	"github.com/anandvarma/namegen"
	"github.com/gorilla/websocket"
)

type userSignupForm struct {
	Username            string `form:"username"`
	Email               string `form:"email"`
	Password            string `form:"password"`
	validator.Validator `form:"-"`
}

type userLoginForm struct {
	Username            string `form:"username"`
	Password            string `form:"password"`
	validator.Validator `form:"-"`
}

func (app *application) websocket(w http.ResponseWriter, r *http.Request) {
	conn, err := app.upgrader.Upgrade(w, r, nil)
	if err != nil {
		app.infoLog.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// initial read user id:n tarkisatamista varten
	var player *models.Player
	_, data, err := conn.ReadMessage()
	if err != nil {
		app.infoLog.Printf("Initial webSocket read error: %v", err)
	} else {
		floats := make([]float64, len(data)/8)
		for i := range floats {
			bits := binary.LittleEndian.Uint64(data[i*8 : (i+1)*8])
			floats[i] = math.Float64frombits(bits)
		}

		id := int(floats[0])

		app.infoLog.Printf("id from game to backend: %v", id)
		// guest id on random tyypin 32-bit unsigned integer
		// jos id on pienempi kuin, 1000000000 niin se on käyttäjä id
		// (täytyy vain toivoa, että tällä ei tule olemaan yli miljardi käyttäjää)
		if id <= 999999999 {
			app.infoLog.Print("Handling user")
			user, err := app.users.Get(id)
			if err != nil {
				app.errorLog.Printf("Error getting user: %v", err)
				return
			}

			player, err = app.players.GetByUser(*user)
			if err != nil {
				// Luodaan pelaaja käyttäjälle, jos ei löydy tietokannasta
				app.infoLog.Printf("Creating new player session")
				newPlayer := models.NewPlayer(*user)
				err = app.players.Insert(newPlayer)
				if err != nil {
					app.errorLog.Printf("Error inserting player: %v", err)
					return
				}
				player = &newPlayer
			} else {
				app.infoLog.Printf("Found player session, attaching client to that. name: %v, id: %v", player.Name, player.Id)
			}
		} else if id > 999999999 {
			// Vieraskäyttäjä
			app.infoLog.Print("Handling guest user")
			guestPlayer, err := app.players.GetById(id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					app.infoLog.Print("Player not found, creating new guest player")

					// nimi generaattori
					name_schema := []namegen.DictType{
						namegen.Adjectives,
					}
					ngen := namegen.NewWithDicts(name_schema)
					name := strings.Join([]string{ngen.Get(), "stranger"}, "-")
					app.infoLog.Printf("Playername: %v", name)

					newPlayer := models.NewGuestPlayer(id, name)
					err := app.players.Insert(newPlayer)
					if err != nil {
						app.errorLog.Printf("Error inserting guest player: %v", err)
						return
					}
					guestPlayer = &newPlayer

				} else {
					app.errorLog.Printf("Database error getting player: %v", err)
					return
				}
			} else {
				app.infoLog.Printf("player found by query. name: %v, id: %v", guestPlayer.Name, guestPlayer.Id)
			}

			player = guestPlayer
		} else {
			app.errorLog.Print("No valid user ID from the game")
			return
		}
	}

	app.infoLog.Printf("WebSocket connected: %v", conn.LocalAddr().String())

	app.infoLog.Printf("Player %v connected by websocket with id %v", player.Name, player.Id)

	for {
		// vastaanotetaan data yhdistetyltä clientiltä
		_, data, err := conn.ReadMessage()
		if err != nil {
			app.infoLog.Printf("WebSocket read error: %v", err)
			break
		}

		floats := make([]float64, len(data)/8)
		for i := range floats {
			bits := binary.LittleEndian.Uint64(data[i*8 : (i+1)*8])
			floats[i] = math.Float64frombits(bits)
		}
		// floats[0] playerId
		// floats[1:4] position (x,y,z)
		// floats[4:8] rotation (x,y,z,w)
		// floats[8:11] velocity (x,y,z)
		// floats[11] activity bool
		// floats[12] epoch time
		//	app.infoLog.Printf("Received data from player %v:\npos(%.2f, %.2f, %.2f)\nrot(%.2f, %.2f, %2f, %2f)\nvel(%.2f, %.2f, %.2f)\n",
		//		player.Id,
		//		floats[1], floats[2], floats[3],
		//		floats[4], floats[5], floats[6], floats[7],
		//		floats[8], floats[9], floats[10])

		// kirjoitetaan sijaintitiedot tietokantaan
		location := models.Location{
			PositionX: floats[1], PositionY: floats[2], PositionZ: floats[3],
			RotationX: floats[4], RotationY: floats[5], RotationZ: floats[6], RotationW: floats[7],
			VelocityX: floats[8], VelocityY: floats[9], VelocityZ: floats[10],
		}
		if floats[11] == 1.0 {
			app.players.UpdateActivity(player.Id)
		}
		clientTime := int64(floats[12])
		clientToServerTime := time.Now().UnixMilli() - int64(clientTime)

		app.infoLog.Printf("client to server latency: %v ms", clientToServerTime)
		err = app.locations.Save(player.Id, location)
		if err != nil {
			app.errorLog.Printf("Websocket write error: %v", err)
		}

		// luetaan muiden pelaajien sijaintitiedot tietokannasta ja lähetetään clientille
		activePlayers, err := app.players.GetAllActive()
		if err != nil {
			app.errorLog.Printf("Error getting active players: %v", err)
			continue
		}

		var validPlayers []*models.Player
		for i := 0; i < len(activePlayers); i++ {
			// oma sijainti
			if activePlayers[i].Id == player.Id {
				continue
			}

			app.infoLog.Printf("Active player found with last activity %v", time.Since(activePlayers[i].LastActive))

			l, err := app.locations.Get(activePlayers[i].Id)
			if err != nil {
				app.errorLog.Printf("Error getting location of active player %v: %v", activePlayers[i].Id, err)
				continue
			}
			if l == nil {
				app.infoLog.Printf("No locations found from db for client %v", activePlayers[i].Id)
				continue
			}
			activePlayers[i].Location = l
			validPlayers = append(validPlayers, activePlayers[i])
		}

		if len(validPlayers) > 0 {

			// timestamp + pelaajakohtaisen datan pituus
			responseData := make([]float64, 1+len(validPlayers)*12)
			responseData[0] = float64(clientTime)
			for i := 0; i < len(validPlayers); i++ {
				var acitivity float64
				if time.Since(validPlayers[i].LastActive) < time.Minute {
					acitivity = 1.0
				} else {
					acitivity = 0.0
				}
				baseIndex := 1 + i*12
				responseData[baseIndex] = float64(validPlayers[i].Id)
				responseData[baseIndex+1] = validPlayers[i].Location.PositionX
				responseData[baseIndex+2] = validPlayers[i].Location.PositionY
				responseData[baseIndex+3] = validPlayers[i].Location.PositionZ
				responseData[baseIndex+4] = validPlayers[i].Location.RotationX
				responseData[baseIndex+5] = validPlayers[i].Location.RotationY
				responseData[baseIndex+6] = validPlayers[i].Location.RotationZ
				responseData[baseIndex+7] = validPlayers[i].Location.RotationW
				responseData[baseIndex+8] = validPlayers[i].Location.VelocityX
				responseData[baseIndex+9] = validPlayers[i].Location.VelocityY
				responseData[baseIndex+10] = validPlayers[i].Location.VelocityZ
				responseData[baseIndex+11] = acitivity
			}

			buf := make([]byte, len(responseData)*8)
			for i := 0; i < len(responseData); i++ {
				binary.LittleEndian.PutUint64(buf[i*8:], math.Float64bits(responseData[i]))
			}

			err = conn.WriteMessage(websocket.BinaryMessage, buf)
			if err != nil {
				app.errorLog.Printf("Error sending player data to client: %v", err)
			}
		} else {

			responseData := make([]float64, 1)
			responseData[0] = float64(clientTime)

			buf := make([]byte, len(responseData)*8)
			for i := 0; i < len(responseData); i++ {
				binary.LittleEndian.PutUint64(buf[i*8:], math.Float64bits(responseData[i]))
			}
		}

	}

	app.infoLog.Println("WebSocket disconnected")
}

func (app *application) home(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)

	app.render(writer, http.StatusOK, "home.tmpl", data)
}

func (app *application) game(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	app.render(writer, http.StatusOK, "game.tmpl", data)
}

func (app *application) userSignup(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	data.Form = userSignupForm{}
	app.render(writer, http.StatusOK, "signup.tmpl", data)
}

func (app *application) userSignupPost(writer http.ResponseWriter, request *http.Request) {
	var form userSignupForm
	err := app.decodePostForm(request, &form)
	if err != nil {
		app.clientError(writer, http.StatusBadRequest)
		return
	}

	form.CheckField(validator.NotBlank(form.Username), "username", "This field cannot be blank")
	if validator.NotBlank(form.Email) {
		form.CheckField(validator.Matches(form.Email, validator.EmailRX), "email", "This field must be a valid email address")
	}
	form.CheckField(validator.NotBlank(form.Password), "password", "This field cannot be blank")
	form.CheckField(validator.MinChars(form.Password, 8), "password", "This field must be at least 8 characters long")

	if !form.Valid() {
		data := app.newTemplateData(request)
		data.Form = form
		app.render(writer, http.StatusUnprocessableEntity, "signup.tmpl", data)
		return
	}

	_, err = app.users.Insert(form.Username, form.Email, form.Password)
	if err != nil {
		if errors.Is(err, models.ErrDuplicateUsername) {
			form.AddFieldError("username", "Username is already in use")
			data := app.newTemplateData(request)
			data.Form = form
			app.render(writer, http.StatusUnprocessableEntity, "signup.tmpl", data)
		} else {
			app.serverError(writer, err)
			app.sessionManager.Put(request.Context(), "flash", fmt.Sprintf("Error in signup %v", err))
		}
		return
	}

	app.sessionManager.Put(request.Context(), "flash", "Your signup was successful. Plese log in.")

	http.Redirect(writer, request, "/user/login", http.StatusSeeOther)

}

func (app *application) userLogin(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	data.Form = userLoginForm{}
	app.render(writer, http.StatusOK, "login.tmpl", data)
}

func (app *application) userLoginPost(writer http.ResponseWriter, request *http.Request) {
	var form userLoginForm

	err := app.decodePostForm(request, &form)
	if err != nil {
		app.clientError(writer, http.StatusBadRequest)
		return
	}

	form.CheckField(validator.NotBlank(form.Username), "username", "This field cannot be blank")
	form.CheckField(validator.NotBlank(form.Password), "password", "This field cannot be blank")

	if !form.Valid() {
		data := app.newTemplateData(request)
		data.Form = form
		app.render(writer, http.StatusUnprocessableEntity, "login.tmpl", data)
		return
	}

	id, err := app.users.Authenticate(form.Username, form.Password)
	if err != nil {
		if errors.Is(err, models.ErrInvalidCredentials) {
			form.AddNonFieldError("Email or password is incorrect")

			data := app.newTemplateData(request)
			data.Form = form
			app.render(writer, http.StatusUnprocessableEntity, "login.tmpl", data)
		} else {
			app.serverError(writer, err)
		}
		return
	}

	err = app.sessionManager.RenewToken(request.Context())
	if err != nil {
		app.serverError(writer, err)
		return
	}

	app.sessionManager.Put(request.Context(), "authenticatedUserId", id)

	http.Redirect(writer, request, "/", http.StatusSeeOther)
}

func (app *application) userLogoutPost(writer http.ResponseWriter, request *http.Request) {
	err := app.sessionManager.RenewToken(request.Context())
	if err != nil {
		app.serverError(writer, err)
		return
	}

	app.sessionManager.Remove(request.Context(), "authenticatedUserId")

	app.sessionManager.Put(request.Context(), "flash", "You've been logged out successfully!")

	http.Redirect(writer, request, "/", http.StatusSeeOther)
}

func ping(writer http.ResponseWriter, request *http.Request) {
	writer.Write([]byte("OK"))
}
