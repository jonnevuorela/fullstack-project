package main

import (
	"flag"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/alexedwards/scs/v2"

	_ "github.com/go-sql-driver/mysql"

	"github.com/gorilla/websocket"
)

type application struct {
	errorLog       *log.Logger
	infoLog        *log.Logger
	templateCache  map[string]*template.Template
	sessionManager *scs.SessionManager
	upgrader       websocket.Upgrader
}

func main() {
	addr := flag.String("addr", ":4000", "HTTP network address")

	infoLog := log.New(os.Stdout, "\033[42;30mINFO\033[0m\t", log.Ldate|log.Ltime)
	errorLog := log.New(os.Stderr, "\033[41;30mERROR\033[0m\t", log.Ldate|log.Ltime|log.Lshortfile)

	templateCache, err := newTemplateCache()
	if err != nil {
		errorLog.Fatal(err)
	}

	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	sessionManager := scs.New()
	sessionManager.Lifetime = 12 * time.Hour

	sessionManager.Cookie.Secure = true
	app := &application{
		errorLog:       errorLog,
		infoLog:        infoLog,
		templateCache:  templateCache,
		sessionManager: sessionManager,

		upgrader: upgrader,
	}

	srv := &http.Server{
		Addr:         *addr,
		Handler:      app.routes(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	infoLog.Printf("Starting server on http://localhost%s", *addr)
	err = srv.ListenAndServe()
	errorLog.Fatal(err)
}
