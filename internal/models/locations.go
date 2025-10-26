package models

import (
	"database/sql"
	"errors"

	"github.com/go-sql-driver/mysql"
)

type Location struct {
	PositionX float64
	PositionY float64
	PositionZ float64
	RotationX float64
	RotationY float64
	RotationZ float64
	RotationW float64
	VelocityX float64
	VelocityY float64
	VelocityZ float64
}

type LocationModelIntarface interface {
	Get(id int) (*Location, error)
	Save(id int, location Location) error
	UpdateLocationFromDB(id int, location *Location) error
	UpdateDBWithLocation(id int, location Location) error
	Insert(id int, location Location) error
}

type LocationModel struct {
	DB *sql.DB
}

func (l *LocationModel) Save(id int, location Location) error {
	stmt := `INSERT INTO locations (
        players_id,
        position_x, position_y, position_z,
        rotation_x, rotation_y, rotation_z, rotation_w,
        velocity_x, velocity_y, velocity_z
    ) VALUES (
        ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
    ) ON DUPLICATE KEY UPDATE
        position_x = VALUES(position_x),
        position_y = VALUES(position_y),
        position_z = VALUES(position_z),
        rotation_x = VALUES(rotation_x),
        rotation_y = VALUES(rotation_y),
        rotation_z = VALUES(rotation_z),
        rotation_w = VALUES(rotation_w),
        velocity_x = VALUES(velocity_x),
        velocity_y = VALUES(velocity_y),
        velocity_z = VALUES(velocity_z)`

	_, err := l.DB.Exec(stmt,
		id,
		location.PositionX, location.PositionY, location.PositionZ,
		location.RotationX, location.RotationY, location.RotationZ, location.RotationW,
		location.VelocityX, location.VelocityY, location.VelocityZ,
	)

	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		}
		return err
	}

	return nil
}

func (l *LocationModel) Get(id int) (*Location, error) {
	location := NewLocation()
	stmt := "SELECT * FROM locations WHERE players_id = ?"
	err := l.DB.QueryRow(stmt, id).Scan(
		&id,
		&location.PositionX, &location.PositionY, &location.PositionZ,
		&location.RotationX, &location.RotationY, &location.RotationZ, &location.RotationW,
		&location.VelocityX, &location.VelocityY, &location.VelocityZ,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &location, err
}

// Käytettäväksi hot looppien sisällä päivittämään olemassa oleva
// location uuden allocoimisen sijaan.
func (l *LocationModel) UpdateLocationFromDB(id int, location *Location) error {
	stmt := "SELECT * FROM locations WHERE players_id= ?"
	err := l.DB.QueryRow(stmt, id).Scan(
		&id,
		&location.PositionX, &location.PositionY, &location.PositionZ,
		&location.RotationX, &location.RotationY, &location.RotationZ, &location.RotationW,
		&location.VelocityX, &location.VelocityY, &location.VelocityZ,
	)
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		} else {
			return err
		}
	}
	return nil
}

// Insert
// Kannattaa käyttää Save functiota jos mahdollista
func (l *LocationModel) Insert(id int, location Location) error {
	stmt := `INSERT INTO locations (
		players_id
		position_x, position_y, position_z,
		rotation_x, rotation_y, rotation_z, rotation_w,
		velocity_x, velocity_y, velocity_z
		)
		VALUES(
		?,
		?,?,?,
		?,?,?,?,
		?,?,?)`
	_, err := l.DB.Exec(stmt,
		id,
		location.PositionX, location.PositionY, location.PositionZ,
		location.RotationX, location.RotationY, location.RotationZ, location.RotationW,
		location.VelocityX, location.VelocityY, location.VelocityZ,
	)
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		}
	}
	return nil
}

// UpdateDBWithLocation
// Kannattaa käyttää Save functiota jos mahdollista
func (l *LocationModel) UpdateDBWithLocation(id int, location Location) error {
	stmt := `UPDATE locations
				SET position_x = ?, position_y = ?, position_z = ?,
					 rotation_x = ?, rotation_y = ?, rotation_z = ?, rotation_w = ?,
					 velocity_x = ?, velocity_y = ?, velocity_z = ?
				WHERE players_id= ?`

	_, err := l.DB.Exec(stmt,
		location.PositionX, location.PositionY, location.PositionZ,
		location.RotationX, location.RotationY, location.RotationZ, location.RotationW,
		location.VelocityX, location.VelocityY, location.VelocityZ,
		id,
	)
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		} else {
			return err
		}
	}
	return nil
}

func NewLocation() Location {
	return Location{
		PositionX: 0, PositionY: 0, PositionZ: 0,
		RotationX: 0, RotationY: 0, RotationZ: 0, RotationW: 1,
		VelocityX: 0, VelocityY: 0, VelocityZ: 0,
	}
}
