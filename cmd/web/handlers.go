package main

import (
	"encoding/binary"
	"math"
	"net/http"
)

type Vec3 struct {
	x float64
	y float64
	z float64
}

type Vec4 struct {
	x float64
	y float64
	z float64
	w float64
}

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
		app.infoLog.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	app.infoLog.Printf("WebSocket connected: %v", conn.LocalAddr().String())

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

func ping(writer http.ResponseWriter, request *http.Request) {
	writer.Write([]byte("OK"))
}
