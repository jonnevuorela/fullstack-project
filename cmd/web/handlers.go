package main

import (
	"log"
	"net/http"
)

func (app *application) home(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)

	app.render(writer, http.StatusOK, "home.tmpl", data)
}

func (app *application) game(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)

	app.render(writer, http.StatusOK, "game.tmpl", data)
}

func (app *application) websocket(w http.ResponseWriter, r *http.Request) {
	conn, err := app.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Println("WebSocket connected")

	for {
		var msg map[string]interface{}
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}
		playerID, _ := msg["player_id"].(float64)
		action, _ := msg["action"].(map[string]interface{})
		log.Printf("Received from player %v: %v", int(playerID), action)

		response := map[string]interface{}{
			"entities": []map[string]interface{}{
				{
					"id":       int(playerID),
					"position": map[string]float64{"x": 0, "y": 3, "z": 0},
					"velocity": map[string]float64{"x": 0, "y": 0, "z": 0},
				},
			},
		}
		err = conn.WriteJSON(response)
		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			break
		}
	}
	log.Println("WebSocket disconnected")
}

func ping(writer http.ResponseWriter, request *http.Request) {
	writer.Write([]byte("OK"))
}
