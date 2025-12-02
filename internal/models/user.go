package models

import (
	"database/sql"
	"errors"
	"log"
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

	SavedTune     int
	SavedLocation int
}

type UserModel struct {
	DB *sql.DB
}
type UserModelInterface interface {
	Insert(username string, email string, password string) (int, error)
	Authenticate(username string, password string) (int, error)
	Exists(id int) (bool, error)
	Get(id int) (*User, error)
	Update(id int, username, email, password string) error
	UpdateSavedTune(userID int, tuneID int) error
}

func (m *UserModel) Authenticate(email string, password string) (int, error) {
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

func (m *UserModel) Insert(username string, email string, password string) (int, error) {
	println("============ User model Insert ============")
	println("username", username)
	if email != "" {
		println("email", email)
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return 0, err
	}
	println("password hash", hashedPassword)

	var result sql.Result
	println(email)
	var stmt string
	if email != "" {
		stmt = `INSERT INTO users (username, email, hashed_password, create_time)
   VALUES(?, ?, ?, UTC_TIMESTAMP())`
		result, err = m.DB.Exec(stmt, username, email, string(hashedPassword))
	} else {
		stmt = `INSERT INTO users (username, hashed_password, create_time)
   VALUES(?, ?, UTC_TIMESTAMP())`
		result, err = m.DB.Exec(stmt, username, string(hashedPassword))
	}
	if err != nil {
		log.Println("Exec error:", err)
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			if mySQLError.Number == 1062 && strings.Contains(mySQLError.Message, "for key 'username_UNIQUE'") {
				println(mySQLError)
				return 0, ErrDuplicateUsername
			}
		}
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		log.Println("RowsAffected err:", err)
	}
	log.Println("Rows affected:", rows)

	println("================== ok ======================")
	return int(id), nil
}

func (m *UserModel) Exists(id int) (bool, error) {
	var exists bool

	stmt := "SELECT EXISTS(SELECT true FROM users WHERE id = ?)"

	err := m.DB.QueryRow(stmt, id).Scan(&exists)
	return exists, err
}

func (m *UserModel) Get(id int) (*User, error) {
	user := User{}
	var email sql.NullString
	stmt := "SELECT * FROM users WHERE id = ?"
	err := m.DB.QueryRow(stmt, id).Scan(
		&user.Id,
		&user.Username,
		&email,
		&user.HashedPassword,
		&user.CreateTime,
		&user.SavedTune,
		&user.SavedLocation,
	)

	if err != nil {
		return nil, err
	}
	if email.Valid {
		user.Email = email.String
	} else {
		user.Email = ""
	}

	return &user, err
}

func (m *UserModel) Update(id int, username, email, password string) error {
	if password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
		if err != nil {
			return err
		}
		stmt := `UPDATE users SET username = ?, email = ?, hashed_password = ? WHERE id = ?`
		_, err = m.DB.Exec(stmt, username, email, string(hashedPassword), id)
		if err != nil {
			return err
		}
		return nil
	}

	stmt := `UPDATE users SET username = ?, email = ? WHERE id = ?`
	_, err := m.DB.Exec(stmt, username, email, id)
	if err != nil {
		return err
	}
	return nil
}

func (m *UserModel) UpdateSavedTune(userID int, tuneID int) error {
	stmt := `UPDATE users SET saved_tune_id = ? WHERE id = ?`
	_, err := m.DB.Exec(stmt, tuneID, userID)
	if err != nil {
		return err
	}
	return nil
}
