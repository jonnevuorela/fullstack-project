package mocks

import (
	"fullstack-project.jonnevuorela.com/internal/models"
)

type LocationModel struct {
	Locations map[int]*models.Location

	GetErrByID    map[int]error
	InsertErrByID map[int]error
	SaveErrByID   map[int]error
	UpdateErrByID map[int]error
}

// muistinsisäinen mock location modelista joka toteuttaa location model interfacen backend sovelluksen testausta varten
func NewLocationModelMock() *LocationModel {
	m := &LocationModel{
		Locations:     make(map[int]*models.Location),
		GetErrByID:    make(map[int]error),
		InsertErrByID: make(map[int]error),
		SaveErrByID:   make(map[int]error),
		UpdateErrByID: make(map[int]error),
	}

	l := models.NewLocation()
	m.Locations[1] = &l

	return m
}

func (m *LocationModel) Get(id int) (*models.Location, error) {
	if err, ok := m.GetErrByID[id]; ok {
		return nil, err
	}
	l, ok := m.Locations[id]
	if !ok {
		return nil, nil
	}
	c := *l
	return &c, nil
}

func (m *LocationModel) Save(id int, location models.Location) error {
	if err, ok := m.SaveErrByID[id]; ok {
		return err
	}
	c := location
	m.Locations[id] = &c
	return nil
}

func (m *LocationModel) UpdateLocationFromDB(id int, location *models.Location) error {
	if err, ok := m.UpdateErrByID[id]; ok {
		return err
	}
	l, ok := m.Locations[id]
	if !ok {
		return models.ErrNoRecord
	}
	*location = *l
	return nil
}

func (m *LocationModel) UpdateDBWithLocation(id int, location models.Location) error {
	if err, ok := m.UpdateErrByID[id]; ok {
		return err
	}
	if _, ok := m.Locations[id]; !ok {
		return models.ErrNoRecord
	}
	c := location
	m.Locations[id] = &c
	return nil
}

func (m *LocationModel) Insert(id int, location models.Location) error {
	if err, ok := m.InsertErrByID[id]; ok {
		return err
	}
	c := location
	m.Locations[id] = &c
	return nil
}
