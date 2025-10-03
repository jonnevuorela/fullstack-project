package models

import "database/sql"

type Player struct {
	PlayerId   int
	Name       string
	ActiveTune Tune
	PositionX  float64
	PositionY  float64
	PositionZ  float64
	RotationX  float64
	RotationY  float64
	RotationZ  float64
	RotationW  float64
	VelocityX  float64
	VelocityY  float64
	VelocityZ  float64
}

type PlayerModel struct {
	DB *sql.DB
}

type PlayerModelIntarface interface {
	Insert(player Player) error
	Get(id int) (*Player, error)
	UpdateLocation(player Player) error
}

func NewPlayer(user User) Player {
	return Player{
		PlayerId:   int(user.Id),
		Name:       user.Username,
		ActiveTune: user.SavedTune,
		PositionX:  user.LastLocation[0],
		PositionY:  user.LastLocation[1],
		PositionZ:  user.LastLocation[2],
		RotationX:  user.LastLocation[3],
		RotationY:  user.LastLocation[4],
		RotationZ:  user.LastLocation[5],
		RotationW:  user.LastLocation[6],
		VelocityX:  0,
		VelocityY:  0,
		VelocityZ:  0,
	}
}
