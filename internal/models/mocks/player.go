package mocks

import (
	"time"

	"fullstack-project.jonnevuorela.com/internal/models"
)

type PlayerModel struct {
	Players map[int]*models.Player

	InsertErrByName map[string]error
	GetErrByID      map[int]error

	Now func() time.Time
}

// muistinsisäinen mock player modelista joka toteuttaa player model interfacen backend sovelluksen testausta varten
func NewPlayerModelMock() *PlayerModel {
	now := time.Now
	m := &PlayerModel{
		Players:         make(map[int]*models.Player),
		InsertErrByName: make(map[string]error),
		GetErrByID:      make(map[int]error),
		Now:             now,
	}

	m.Players[1] = &models.Player{Id: 1, UserId: 1, Name: "player1", LastActive: m.Now()}
	m.Players[2] = &models.Player{Id: 2, UserId: 2, Name: "player2", LastActive: m.Now()}
	m.Players[3] = &models.Player{Id: 3, UserId: 3, Name: "player3", LastActive: m.Now().Add(-10 * time.Hour)}
	m.Players[1010101010] = &models.Player{Id: 1010101010, UserId: 0, Name: "guest1", LastActive: m.Now()}

	return m
}

func (m *PlayerModel) Insert(player models.Player) error {
	if err, ok := m.InsertErrByName[player.Name]; ok {
		return err
	}
	if _, exists := m.Players[player.Id]; exists {
		return models.ErrDuplicateUsername
	}
	c := player
	m.Players[player.Id] = &c
	return nil
}

func (m *PlayerModel) UpdateActivity(id int) error {
	p, ok := m.Players[id]
	if !ok {
		return models.ErrNoRecord
	}
	p.LastActive = m.Now()
	return nil
}

func (m *PlayerModel) GetById(id int) (*models.Player, error) {
	if err, ok := m.GetErrByID[id]; ok {
		return nil, err
	}
	p, ok := m.Players[id]
	if !ok {
		return nil, models.ErrNoRecord
	}
	c := *p
	return &c, nil
}

func (m *PlayerModel) GetByUser(user models.User) (*models.Player, error) {
	for _, p := range m.Players {
		if p.UserId == int(user.Id) {
			c := *p
			return &c, nil
		}
	}
	return nil, models.ErrNoRecord
}

func (m *PlayerModel) GetAllActive() ([]*models.Player, error) {
	var out []*models.Player
	for _, p := range m.Players {
		c := *p
		out = append(out, &c)
	}
	return out, nil
}
