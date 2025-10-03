package models

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	Id             float64
	Username       string
	Email          string
	HashedPassword []byte
	CreateTime     time.Time

	SavedTune    Tune
	LastLocation [7]float64 // Vec3 position + Vec4 rotation
}

type UserModel struct {
	DB *sql.DB
}
type UserModelInterface interface {
	Insert(username string, email string, password string) error
	Authenticate(username string, password string) (int, error)
	Exists(id int) (bool, error)
}

func (m *UserModel) Authenticate(email, password string) (int, error) {
	var id int
	var hashedPassword []byte

	stmt := "SELECT id, hashed_password FROM users WHERE username = ?"

	err := m.DB.QueryRow(stmt, email).Scan(&id, &hashedPassword)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrInvalidCredentials
		} else {
			return 0, err
		}
	}

	err = bcrypt.CompareHashAndPassword(hashedPassword, []byte(password))
	if err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return 0, ErrInvalidCredentials
		} else {
			return 0, err
		}
	}

	return id, nil
}

func (m *UserModel) Insert(username string, email string, password string) error {

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	tune := NewTune()
	location := [7]float64{0, 0, 0, 0, 0, 0, 1}

	if email != "" {
		stmt := `INSERT INTO users (username, email, hashed_password, create_time, last_location, saved_tune)
   VALUES(?, ?, ?, UTC_TIMESTAMP(),?, ?)`
		_, err = m.DB.Exec(stmt, username, email, string(hashedPassword), location, tune)
	} else {
		stmt := `INSERT INTO users (username, hashed_password, create_time, last_location, saved_tune)
   VALUES(?, ?, UTC_TIMESTAMP(),?, ?)`
		_, err = m.DB.Exec(stmt, username, string(hashedPassword), location, tune)
	}

	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			if mySQLError.Number == 1062 && strings.Contains(mySQLError.Message, "users_uc_username") {
				return ErrDuplicateUsername
			}
		}
		return nil
	}
	return nil
}

func (m *UserModel) Exists(id int) (bool, error) {
	var exists bool

	stmt := "SELECT EXISTS(SELECT true FROM users WHERE id = ?)"

	err := m.DB.QueryRow(stmt, id).Scan(&exists)
	return exists, err
}
