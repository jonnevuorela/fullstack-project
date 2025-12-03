package main

import (
	"crypto/tls"
	"database/sql"
	"flag"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"fullstack-project.jonnevuorela.com/internal/models"

	"github.com/alexedwards/scs/mysqlstore"
	"github.com/alexedwards/scs/v2"
	"github.com/go-playground/form/v4"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

type application struct {
	errorLog       *log.Logger
	infoLog        *log.Logger
	users          models.UserModelInterface
	players        models.PlayerModelIntarface
	locations      models.LocationModelIntarface
	tunes          models.TuneModelIntarface
	templateCache  map[string]*template.Template
	sessionManager *scs.SessionManager
	upgrader       websocket.Upgrader
	formDecoder    *form.Decoder
	wsConnsMu      sync.Mutex
	wsConns        map[*websocket.Conn]struct{}
}

func main() {
	infoLog := log.New(os.Stdout, "\033[42;30mINFO\033[0m\t", log.Ldate|log.Ltime)
	errorLog := log.New(os.Stderr, "\033[41;30mERROR\033[0m\t", log.Ldate|log.Ltime|log.Lshortfile)

	addr := flag.String("addr", "0.0.0.0:4000", "HTTP network address")
	devMode := flag.Bool("dev", false, "Development mode")

	err := godotenv.Load(".env")
	if err != nil {
		errorLog.Fatal(err)
	}

	dbInfo := fmt.Sprintf("%v:%v@tcp(127.0.0.1:%v)/%v?parseTime=true",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	dsn := flag.String("dsn", dbInfo, "MySQL data source name")

	flag.Parse()

	templateCache, err := newTemplateCache()
	if err != nil {
		errorLog.Fatal(err)
	}
	if *devMode {
		infoLog.Println("Running in development mode")
		templateCache = nil
	} else {
		var err error
		templateCache, err = newTemplateCache()
		if err != nil {
			errorLog.Fatal(err)
		}
	}

	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	db, err := openDB(*dsn)
	if err != nil {
		errorLog.Fatal(err)
	}
	defer db.Close()

	formDecoder := form.NewDecoder()

	sessionManager := scs.New()
	sessionManager.Store = mysqlstore.New(db)
	sessionManager.Lifetime = 12 * time.Hour

	sessionManager.Cookie.Secure = true
	sessionManager.Cookie.SameSite = http.SameSiteNoneMode
	sessionManager.Cookie.HttpOnly = true

	tlsConfig := &tls.Config{
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
	}

	app := &application{
		errorLog:       errorLog,
		infoLog:        infoLog,
		templateCache:  templateCache,
		sessionManager: sessionManager,
		formDecoder:    formDecoder,
		upgrader:       upgrader,
		wsConns:        make(map[*websocket.Conn]struct{}),

		users:     &models.UserModel{DB: db},
		players:   &models.PlayerModel{DB: db},
		locations: &models.LocationModel{DB: db},
		tunes:     &models.TuneModel{DB: db},
	}

	srv := &http.Server{
		Addr:         *addr,
		Handler:      app.routes(),
		TLSConfig:    tlsConfig,
		IdleTimeout:  time.Minute,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	infoLog.Printf("Starting server on https://%s", *addr)
	// Self signed certifcaatit local developmentia varten,
	// prod serverillä cloudflare huolehtii TLS.
	err = srv.ListenAndServeTLS("./tls/cert.pem", "./tls/key.pem")
	errorLog.Fatal(err)
}

func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}
