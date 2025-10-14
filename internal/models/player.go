package models

import (
	"database/sql"
	"errors"

	"github.com/go-sql-driver/mysql"
)

type Player struct {
	UserId int
	Name   string
}

type PlayerModel struct {
	DB *sql.DB
}

type PlayerModelIntarface interface {
	Insert(player Player) error
	GetByUser(user User) (*Player, error)
}

func (p *PlayerModel) GetByUser(user User) (*Player, error) {
	player := NewPlayer(user)
	stmt := "SELECT * FROM players WHERE user_id = ?"
	err := p.DB.QueryRow(stmt, player.UserId).Scan(
		&player.UserId,
		&player.Name,
	)
	if err != nil {
		return nil, err
	}
	return &player, err
}

func (p *PlayerModel) Insert(player Player) error {
	stmt := `INSERT INTO players (user_id, player_name) VALUES(?, ?)`
	_, err := p.DB.Exec(stmt,
		player.UserId, player.Name,
	)
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
		UserId: int(user.Id),
		Name:   user.Username,
	}
}
