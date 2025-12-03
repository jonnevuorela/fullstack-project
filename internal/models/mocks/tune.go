package mocks

import (
	"fullstack-project.jonnevuorela.com/internal/models"
)

type TuneModel struct {
	Tunes         map[int]*models.Tune
	nextID        int
	GetErrByID    map[int]error
	SaveErrByID   map[int]error
	UpdateErrByID map[int]error
	InsertErr     error
	UpdateErr     error
}

func NewTuneModelMock() *TuneModel {
	m := &TuneModel{
		Tunes:         make(map[int]*models.Tune),
		nextID:        2,
		GetErrByID:    make(map[int]error),
		SaveErrByID:   make(map[int]error),
		UpdateErrByID: make(map[int]error),
	}
	defaultTune := models.NewTune()
	m.Tunes[1] = &defaultTune
	return m
}

func (m *TuneModel) Insert(tune models.Tune) (*int, error) {
	if m.InsertErr != nil {
		return nil, m.InsertErr
	}
	id := m.nextID
	m.nextID++
	t := tune
	m.Tunes[id] = &t
	return &id, nil
}

func (m *TuneModel) Get(id int) (*models.Tune, error) {
	if err, ok := m.GetErrByID[id]; ok {
		return nil, err
	}
	t, ok := m.Tunes[id]
	if !ok {
		return nil, nil
	}
	c := *t
	return &c, nil
}

func (m *TuneModel) UpdateDBWithTune(id int, tune models.Tune) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	if err, ok := m.UpdateErrByID[id]; ok {
		return err
	}
	if _, ok := m.Tunes[id]; !ok {
		return models.ErrNoRecord
	}
	c := tune
	m.Tunes[id] = &c
	return nil
}
