package models

import (
	"database/sql"
	"errors"
	"log"
	"time"

	"github.com/go-sql-driver/mysql"
)

type Player struct {
	Id         int
	UserId     int
	Name       string
	CreateTime time.Time
	LastActive time.Time
	Location   *Location
}

type PlayerModel struct {
	DB *sql.DB
}

type PlayerModelIntarface interface {
	Insert(player Player) error
	GetAllActive() ([]*Player, error)
	GetByUser(user User) (*Player, error)
	GetById(id int) (*Player, error)
	UpdateActivity(id int) error
}

func (p *PlayerModel) UpdateActivity(id int) error {
	stmt := `UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := p.DB.Exec(stmt, id)
	if err != nil {
		return err
	}
	return nil
}

func (p *PlayerModel) GetAllActive() ([]*Player, error) {
	stmt := "SELECT * FROM players WHERE last_active > NOW() - INTERVAL 1 MINUTE"
	rows, err := p.DB.Query(stmt)
	if err != nil {
		log.Printf("Error querying active player rows: %v", err)
		return nil, err
	}
	defer rows.Close()

	var players []*Player
	for rows.Next() {
		player := Player{}
		err = rows.Scan(
			&player.Id,
			&player.UserId,
			&player.Name,
			&player.CreateTime,
			&player.LastActive,
		)
		players = append(players, &player)
	}
	if err != nil {
		return nil, err
	}
	return players, nil
}

func (p *PlayerModel) GetByUser(user User) (*Player, error) {
	player := Player{}
	stmt := "SELECT * FROM players WHERE user_id = ?"
	err := p.DB.QueryRow(stmt, user.Id).Scan(
		&player.Id,
		&player.UserId,
		&player.Name,
		&player.CreateTime,
		&player.LastActive,
	)
	if err != nil {
		return nil, err
	} else {
		return &player, nil
	}
}

func (p *PlayerModel) GetById(id int) (*Player, error) {
	player := Player{}
	stmt := "SELECT * FROM players WHERE id = ?"
	err := p.DB.QueryRow(stmt, id).Scan(
		&player.Id,
		&player.UserId,
		&player.Name,
		&player.CreateTime,
		&player.LastActive,
	)
	if err != nil {
		return nil, err
	} else {

		return &player, nil
	}
}

func (p *PlayerModel) Insert(player Player) error {
	var err error
	if player.UserId != 1 {
		stmt := `INSERT INTO players (id, user_id, player_name, create_time) VALUES(?, ?, ?, UTC_TIMESTAMP())`
		_, err = p.DB.Exec(stmt,
			player.Id, player.UserId, player.Name,
		)

	} else {
		stmt := `INSERT INTO players (id, player_name, create_time) VALUES(?, ?, UTC_TIMESTAMP())`
		_, err = p.DB.Exec(stmt,
			player.Id, player.Name,
		)
	}
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		}
	}
	return nil
}

func NewPlayer(user User) Player {
	return Player{
		Id:     int(user.Id),
		UserId: int(user.Id),
		Name:   user.Username,
	}
}

func NewGuestPlayer(id int, name string) Player {
	return Player{
		Id:     id,
		UserId: 1,
		Name:   name,
	}
}
