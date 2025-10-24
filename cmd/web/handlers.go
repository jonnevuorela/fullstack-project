package main

import (
	"database/sql"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"

	"math"
	"net/http"

	"fullstack-project.jonnevuorela.com/internal/models"
	"fullstack-project.jonnevuorela.com/internal/validator"
	"github.com/anandvarma/namegen"
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
				app.errorLog.Printf("Error in player query: %v", err)
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

	app.infoLog.Printf("Player %v connected by websocket with id %v", player.Name, player.UserId)

	for {
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
		app.infoLog.Printf("Received data from player %.0f:\npos(%.2f, %.2f, %.2f)\nrot(%.2f, %.2f, %2f, %2f)\nvel(%.2f, %.2f, %.2f)\n",
			floats[0],
			floats[1], floats[2], floats[3],
			floats[4], floats[5], floats[6], floats[7],
			floats[8], floats[9], floats[10])

		//	playerId := floats[0]
		//	pos := Vec3{floats[1], floats[2], floats[3]}
		//	rot := Vec4{floats[4], floats[5], floats[6]}
		//	vel := Vec3{floats[8], floats[9], floats[10]}

		//	response := map[string]any{
		//		"entities": []map[string]any{
		//			{
		//				"id":       int(playerId),
		//				"position": map[string]float64{"x": 0, "y": 3, "z": 0},
		//				"rotation": map[string]float64{"x": 0, "y": 3, "z": 0, "w": 1},
		//				"velocity": map[string]float64{"x": 0, "y": 0, "z": 0},
		//			},
		//		},
		//	}
		//	err = conn.WriteJSON(response)
		//	if err != nil {
		//		app.infoLog.Printf("WebSocket write error: %v", err)
		//		break
		//	}
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

	err = app.users.Insert(form.Username, form.Email, form.Password)
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
