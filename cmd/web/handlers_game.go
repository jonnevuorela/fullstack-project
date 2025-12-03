package main

import (
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"fullstack-project.jonnevuorela.com/internal/models"
	"github.com/anandvarma/namegen"
	"github.com/gorilla/websocket"
)

func (app *application) game(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	if data.IsAuthenticated {
		userID := app.sessionManager.GetInt(request.Context(), "authenticatedUserId")
		if userID > 0 {
			user, err := app.users.Get(userID)
			if err != nil {
				app.serverError(writer, err)
				return
			}
			data.PlayerUsername = user.Username

			if user.SavedTune > 0 {
				// välitetään tallennettut säädöt tietokannasta peliin frontendin kautta
				tune, err := app.tunes.Get(user.SavedTune)
				if err != nil {
					app.errorLog.Printf("error loading tune for user %d: %v", userID, err)
				} else if tune != nil {
					data.PlayerTune = &clientTune{
						WheelRadius:                  tune.WheelRadius,
						WheelWidth:                   tune.WheelWidth,
						WheelOffset:                  tune.WheelOffset,
						WheelVerticalOffset:          tune.WheelVerticalOffset,
						WheelLongitudalOffset:        tune.WheelLongitudalOffset,
						MaxSteeringAngle:             tune.MaxSteeringAngle,
						SuspensionLenghtMin:          tune.SuspensionLenghtMin,
						SuspensionLenghtMax:          tune.SuspensionLenghtMax,
						SuspensionPreload:            tune.SuspensionPreload,
						SuspensionDamping:            tune.SuspensionDamping,
						SuspensionStiffeness:         tune.SuspensionStiffeness,
						FrontTyreLateralFriction:     tune.FrontTyreLateralFriction,
						FrontTyreLongitudalFriction:  tune.FrontTyreLongitudalFriction,
						RearTyreLateralFriction:      tune.RearTyreLateralFriction,
						RearTyreLongitudalFriction:   tune.RearTyreLongitudalFriction,
						FourWheelDrive:               tune.FourWheelDrive,
						Antirollbar:                  tune.Antirollbar,
						TorqueSplitRatio:             tune.TorqueSplitRatio,
						DifferentialLimitedSlipRatio: tune.DifferentialLimitedSlipRatio,
						MaxEngineTorque:              tune.MaxEngineTorque,
						ClutchStrenght:               tune.ClutchStrenght,
						MinRpm:                       tune.MinRpm,
						MaxRpm:                       tune.MaxRpm,
						DamperMass:                   tune.DamperMass,
						FlywheelMass:                 tune.FlywheelMass,
						VehicleMass:                  tune.VehicleMass,
					}
				}
				// välitetään tallennetti sijainti tietokannasta peliin frontendin kautta
				loc, err := app.locations.Get(int(user.Id))
				if err != nil {
					app.errorLog.Printf("error loading last location for user %d: %v", userID, err)
				} else if loc != nil {
					data.PlayerLocation = &clientLocation{
						PositionX: loc.PositionX,
						PositionY: loc.PositionY,
						PositionZ: loc.PositionZ,
						RotationX: loc.RotationX,
						RotationY: loc.RotationY,
						RotationZ: loc.RotationZ,
						RotationW: loc.RotationW,
					}
				}
			}
		}
	}
	app.render(writer, http.StatusOK, "game.tmpl", data)
}
func (app *application) websocket(w http.ResponseWriter, r *http.Request) {
	conn, err := app.upgrader.Upgrade(w, r, nil)
	if err != nil {
		app.infoLog.Printf("WebSocket upgrade error: %v", err)
		return
	}
	app.wsConnsMu.Lock()
	app.wsConns[conn] = struct{}{}
	app.wsConnsMu.Unlock()

	defer func() {
		app.wsConnsMu.Lock()
		delete(app.wsConns, conn)
		app.wsConnsMu.Unlock()
		conn.Close()
		app.infoLog.Println("WebSocket disconnected")
	}()

	app.infoLog.Printf("WebSocket connected: %v", conn.LocalAddr().String())

	// initial read user id:n tarkisatamista varten
	var player *models.Player

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			app.infoLog.Printf("WebSocket read error: %v", err)
			break
		}

		switch msgType {
		case websocket.TextMessage:
			var msg struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(data, &msg); err != nil {
				app.infoLog.Printf("Bad text message: %v", err)
				continue
			}
			if msg.Type == "roster_request" {
				app.sendRoster(conn)
			}

		case websocket.BinaryMessage:
			floats := make([]float64, len(data)/8)
			for i := range floats {
				bits := binary.LittleEndian.Uint64(data[i*8 : (i+1)*8])
				floats[i] = math.Float64frombits(bits)
			}
			if len(floats) < 13 {
				continue
			}

			if player == nil {
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
					p, err := app.players.GetByUser(*user)
					if err != nil {
						// Luodaan pelaaja käyttäjälle, jos ei löydy tietokannasta
						app.infoLog.Printf("Creating new player session")
						newPlayer := models.NewPlayer(*user)
						if err := app.players.Insert(newPlayer); err != nil {
							app.errorLog.Printf("Error inserting player: %v", err)
							return
						}
						player = &newPlayer

						app.broadcastRosterUpdate()
						app.broadcastTunesUpdate()
					} else {
						player = p
						app.infoLog.Printf("Found player session, attaching client to that. name: %v, id: %v", player.Name, player.Id)
					}
				} else {
					// Vieraskäyttäjä
					app.infoLog.Print("Handling guest user")
					guestPlayer, err := app.players.GetById(id)
					if err != nil {
						if errors.Is(err, sql.ErrNoRows) {
							app.infoLog.Print("Player not found, creating new guest player")

							// nimi generaattori
							nameSchema := []namegen.DictType{namegen.Adjectives}
							ngen := namegen.NewWithDicts(nameSchema)
							name := strings.Join([]string{ngen.Get(), "stranger"}, "-")
							app.infoLog.Printf("Playername: %v", name)

							newPlayer := models.NewGuestPlayer(id, name)
							if err := app.players.Insert(newPlayer); err != nil {
								app.errorLog.Printf("Error inserting guest player: %v", err)
								return
							}
							guestPlayer = &newPlayer

							app.broadcastRosterUpdate()
							app.broadcastTunesUpdate()
						} else {
							app.errorLog.Printf("Database error getting player: %v", err)
							return
						}
					} else {
						app.infoLog.Printf("player found by query. name: %v, id: %v", guestPlayer.Name, guestPlayer.Id)
					}
					player = guestPlayer
				}

				app.infoLog.Printf("Player %v connected by websocket with id %v", player.Name, player.Id)

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
				_ = app.players.UpdateActivity(player.Id)
			}
			clientTime := int64(floats[12])
			clientToServerTime := time.Now().UnixMilli() - clientTime

			app.infoLog.Printf("client to server latency: %v ms", clientToServerTime)
			err := app.locations.Save(player.Id, location)
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

				l, err := app.locations.Get(activePlayers[i].Id)
				if err != nil {
					app.errorLog.Printf("Error getting location of active player %v: %v", activePlayers[i].Id, err)
					continue
				}
				if l == nil {
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

				if err := conn.WriteMessage(websocket.BinaryMessage, buf); err != nil {
					app.errorLog.Printf("Error sending player data to client: %v", err)
				}
			} else {

				responseData := []float64{float64(clientTime)}

				buf := make([]byte, len(responseData)*8)
				binary.LittleEndian.PutUint64(buf, math.Float64bits(responseData[0]))
				if err := conn.WriteMessage(websocket.BinaryMessage, buf); err != nil {
					app.errorLog.Printf("Error sending heartbeat frame: %v", err)
				}
			}

		default:
		}
	}

	app.infoLog.Println("WebSocket disconnected")
}

func (app *application) sendRoster(conn *websocket.Conn) {
	type rosterEntry struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	type rosterMsg struct {
		Type    string        `json:"type"`
		Players []rosterEntry `json:"players"`
		Version int64         `json:"version"`
	}

	activePlayers, err := app.players.GetAllActive()
	if err != nil {
		app.errorLog.Printf("Error building roster: %v", err)
		return
	}

	entries := make([]rosterEntry, 0, len(activePlayers))
	for _, ap := range activePlayers {
		entries = append(entries, rosterEntry{ID: ap.Id, Name: ap.Name})
	}

	msg := rosterMsg{
		Type:    "roster",
		Players: entries,
		Version: time.Now().Unix(),
	}

	payload, err := json.Marshal(msg)
	if err != nil {
		app.errorLog.Printf("Error marshaling roster: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
		app.errorLog.Printf("Error sending roster: %v", err)
	}
}

func (app *application) broadcastRosterUpdate() {
	type rosterEntry struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	type rosterMsg struct {
		Type    string        `json:"type"`
		Players []rosterEntry `json:"players"`
		Version int64         `json:"version"`
	}

	activePlayers, err := app.players.GetAllActive()
	if err != nil {
		app.errorLog.Printf("Error building roster for broadcast: %v", err)
		return
	}
	entries := make([]rosterEntry, 0, len(activePlayers))
	for _, ap := range activePlayers {
		entries = append(entries, rosterEntry{ID: ap.Id, Name: ap.Name})
	}
	msg := rosterMsg{
		Type:    "roster_update",
		Players: entries,
		Version: time.Now().Unix(),
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		app.errorLog.Printf("Error marshaling roster update: %v", err)
		return
	}

	app.wsConnsMu.Lock()
	defer app.wsConnsMu.Unlock()
	for conn := range app.wsConns {
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}
}

func (app *application) sendTunes(conn *websocket.Conn) {
	type tunePayload struct {
		WheelRadius                 float64 `json:"wheel_radius"`
		WheelWidth                  float64 `json:"wheel_width"`
		WheelOffset                 float64 `json:"wheel_offset"`
		WheelVerticalOffset         float64 `json:"wheel_vertical_offset"`
		WheelLongitudalOffset       float64 `json:"wheel_longitudal_offset"`
		MaxSteeringAngle            int     `json:"max_steering_angle"`
		SuspensionLenghtMin         float64 `json:"suspension_lenght_min"`
		SuspensionLenghtMax         float64 `json:"suspension_lenght_max"`
		SuspensionPreload           float64 `json:"suspension_preload"`
		SuspensionDamping           float64 `json:"suspension_damping"`
		SuspensionStiffness         float64 `json:"suspension_stiffness"`
		FrontTyreLateralFriction    float64 `json:"front_tyre_lateral_friction"`
		FrontTyreLongitudalFriction float64 `json:"front_tyre_longitudal_friction"`
		RearTyreLateralFriction     float64 `json:"rear_tyre_lateral_friction"`
		RearTyreLongitudalFriction  float64 `json:"rear_tyre_longitudal_friction"`
		FourWheelDrive              bool    `json:"four_wheel_drive"`
		Antirollbar                 bool    `json:"antirollbar"`
		TorqueSplitRatio            float64 `json:"torque_split_ratio"`
		DifferentialLimitedSlip     float64 `json:"differential_limited_slip_ratio"`
		MaxEngineTorque             float64 `json:"max_engine_torque"`
		ClutchStrenght              float64 `json:"clutch_strenght"`
		MinRpm                      float64 `json:"min_rpm"`
		MaxRpm                      float64 `json:"max_rpm"`
		DamperMass                  float64 `json:"damper_mass"`
		FlywheelMass                float64 `json:"flywheel_mass"`
		VehicleMass                 float64 `json:"vehicle_mass"`
	}
	type entry struct {
		ID   int         `json:"id"`
		Tune tunePayload `json:"tune"`
	}
	type tunesMsg struct {
		Type    string  `json:"type"`
		Players []entry `json:"players"`
		Version int64   `json:"version"`
	}

	activePlayers, err := app.players.GetAllActive()
	if err != nil {
		app.errorLog.Printf("Error building tunes: %v", err)
		return
	}

	players := make([]entry, 0, len(activePlayers))
	for _, ap := range activePlayers {
		var t *models.Tune
		if ap.UserId > 1 {
			if u, err := app.users.Get(ap.UserId); err == nil && u != nil && u.SavedTune > 0 {
				if tt, err := app.tunes.Get(u.SavedTune); err == nil && tt != nil {
					t = tt
				}
			}
		}
		if t == nil {
			if tt, err := app.tunes.Get(1); err == nil && tt != nil {
				t = tt
			} else {
				tmp := models.NewTune()
				t = &tmp
			}
		}

		players = append(players, entry{
			ID: ap.Id,
			Tune: tunePayload{
				WheelRadius:                 t.WheelRadius,
				WheelWidth:                  t.WheelWidth,
				WheelOffset:                 t.WheelOffset,
				WheelVerticalOffset:         t.WheelVerticalOffset,
				WheelLongitudalOffset:       t.WheelLongitudalOffset,
				MaxSteeringAngle:            t.MaxSteeringAngle,
				SuspensionLenghtMin:         t.SuspensionLenghtMin,
				SuspensionLenghtMax:         t.SuspensionLenghtMax,
				SuspensionPreload:           t.SuspensionPreload,
				SuspensionDamping:           t.SuspensionDamping,
				SuspensionStiffness:         t.SuspensionStiffeness,
				FrontTyreLateralFriction:    t.FrontTyreLateralFriction,
				FrontTyreLongitudalFriction: t.FrontTyreLongitudalFriction,
				RearTyreLateralFriction:     t.RearTyreLateralFriction,
				RearTyreLongitudalFriction:  t.RearTyreLongitudalFriction,
				FourWheelDrive:              t.FourWheelDrive,
				Antirollbar:                 t.Antirollbar,
				TorqueSplitRatio:            t.TorqueSplitRatio,
				DifferentialLimitedSlip:     t.DifferentialLimitedSlipRatio,
				MaxEngineTorque:             t.MaxEngineTorque,
				ClutchStrenght:              t.ClutchStrenght,
				MinRpm:                      t.MinRpm,
				MaxRpm:                      t.MaxRpm,
				DamperMass:                  t.DamperMass,
				FlywheelMass:                t.FlywheelMass,
				VehicleMass:                 t.VehicleMass,
			},
		})
	}

	msg := tunesMsg{Type: "tunes", Players: players, Version: time.Now().Unix()}
	payload, err := json.Marshal(msg)
	if err != nil {
		app.errorLog.Printf("Error marshaling tunes: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
		app.errorLog.Printf("Error sending tunes: %v", err)
	}
}

func (app *application) broadcastTunesUpdate() {
	type tunePayload struct {
		WheelRadius                 float64 `json:"wheel_radius"`
		WheelWidth                  float64 `json:"wheel_width"`
		WheelOffset                 float64 `json:"wheel_offset"`
		WheelVerticalOffset         float64 `json:"wheel_vertical_offset"`
		WheelLongitudalOffset       float64 `json:"wheel_longitudal_offset"`
		MaxSteeringAngle            int     `json:"max_steering_angle"`
		SuspensionLenghtMin         float64 `json:"suspension_lenght_min"`
		SuspensionLenghtMax         float64 `json:"suspension_lenght_max"`
		SuspensionPreload           float64 `json:"suspension_preload"`
		SuspensionDamping           float64 `json:"suspension_damping"`
		SuspensionStiffness         float64 `json:"suspension_stiffness"`
		FrontTyreLateralFriction    float64 `json:"front_tyre_lateral_friction"`
		FrontTyreLongitudalFriction float64 `json:"front_tyre_longitudal_friction"`
		RearTyreLateralFriction     float64 `json:"rear_tyre_lateral_friction"`
		RearTyreLongitudalFriction  float64 `json:"rear_tyre_longitudal_friction"`
		FourWheelDrive              bool    `json:"four_wheel_drive"`
		Antirollbar                 bool    `json:"antirollbar"`
		TorqueSplitRatio            float64 `json:"torque_split_ratio"`
		DifferentialLimitedSlip     float64 `json:"differential_limited_slip_ratio"`
		MaxEngineTorque             float64 `json:"max_engine_torque"`
		ClutchStrenght              float64 `json:"clutch_strenght"`
		MinRpm                      float64 `json:"min_rpm"`
		MaxRpm                      float64 `json:"max_rpm"`
		DamperMass                  float64 `json:"damper_mass"`
		FlywheelMass                float64 `json:"flywheel_mass"`
		VehicleMass                 float64 `json:"vehicle_mass"`
	}
	type entry struct {
		ID   int         `json:"id"`
		Tune tunePayload `json:"tune"`
	}
	type tunesMsg struct {
		Type    string  `json:"type"`
		Players []entry `json:"players"`
		Version int64   `json:"version"`
	}

	activePlayers, err := app.players.GetAllActive()
	if err != nil {
		app.errorLog.Printf("Error building tunes for broadcast: %v", err)
		return
	}

	players := make([]entry, 0, len(activePlayers))
	for _, ap := range activePlayers {
		var t *models.Tune
		if ap.UserId > 1 {
			if u, err := app.users.Get(ap.UserId); err == nil && u != nil && u.SavedTune > 0 {
				if tt, err := app.tunes.Get(u.SavedTune); err == nil && tt != nil {
					t = tt
				}
			}
		}
		if t == nil {
			if tt, err := app.tunes.Get(1); err == nil && tt != nil {
				t = tt
			} else {
				tmp := models.NewTune()
				t = &tmp
			}
		}

		players = append(players, entry{
			ID: ap.Id,
			Tune: tunePayload{
				WheelRadius:                 t.WheelRadius,
				WheelWidth:                  t.WheelWidth,
				WheelOffset:                 t.WheelOffset,
				WheelVerticalOffset:         t.WheelVerticalOffset,
				WheelLongitudalOffset:       t.WheelLongitudalOffset,
				MaxSteeringAngle:            t.MaxSteeringAngle,
				SuspensionLenghtMin:         t.SuspensionLenghtMin,
				SuspensionLenghtMax:         t.SuspensionLenghtMax,
				SuspensionPreload:           t.SuspensionPreload,
				SuspensionDamping:           t.SuspensionDamping,
				SuspensionStiffness:         t.SuspensionStiffeness,
				FrontTyreLateralFriction:    t.FrontTyreLateralFriction,
				FrontTyreLongitudalFriction: t.FrontTyreLongitudalFriction,
				RearTyreLateralFriction:     t.RearTyreLateralFriction,
				RearTyreLongitudalFriction:  t.RearTyreLongitudalFriction,
				FourWheelDrive:              t.FourWheelDrive,
				Antirollbar:                 t.Antirollbar,
				TorqueSplitRatio:            t.TorqueSplitRatio,
				DifferentialLimitedSlip:     t.DifferentialLimitedSlipRatio,
				MaxEngineTorque:             t.MaxEngineTorque,
				ClutchStrenght:              t.ClutchStrenght,
				MinRpm:                      t.MinRpm,
				MaxRpm:                      t.MaxRpm,
				DamperMass:                  t.DamperMass,
				FlywheelMass:                t.FlywheelMass,
				VehicleMass:                 t.VehicleMass,
			},
		})
	}

	msg := tunesMsg{Type: "tunes_update", Players: players, Version: time.Now().Unix()}
	payload, err := json.Marshal(msg)
	if err != nil {
		app.errorLog.Printf("Error marshaling tunes update: %v", err)
		return
	}

	app.wsConnsMu.Lock()
	defer app.wsConnsMu.Unlock()
	for conn := range app.wsConns {
		_ = conn.WriteMessage(websocket.TextMessage, payload)
	}
}
