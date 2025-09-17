package main

import (
	"net/http"
	"path/filepath"

	"fullstack-project.jonnevuorela.com/ui"

	"github.com/julienschmidt/httprouter"
	"github.com/justinas/alice"
)

func (app *application) routes() http.Handler {

	router := httprouter.New()

	router.NotFound = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		app.notFound(w)
	})

	fileServer := http.FileServer(http.FS(ui.Files))

	router.Handler(http.MethodGet, "/static/*filepath", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		ext := filepath.Ext(path)

		if ext == ".wasm" {
			w.Header().Set("Content-Type", "application/wasm")
		}

		fileServer.ServeHTTP(w, r)
	}))
	router.HandlerFunc(http.MethodGet, "/ping", ping)
	router.HandlerFunc(http.MethodGet, "/ws", app.websocket)

	dynamic := alice.New(app.sessionManager.LoadAndSave, noSurf)

	router.Handler(http.MethodGet, "/", dynamic.ThenFunc(app.home))
	router.Handler(http.MethodGet, "/game", dynamic.ThenFunc(app.game))

	standard := alice.New(app.recoverPanic, app.logRequest, secureHeaders)
	return standard.Then(router)
}
