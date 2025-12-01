package mocks

import (
	"time"

	"golang.org/x/crypto/bcrypt"

	"fullstack-project.jonnevuorela.com/internal/models"
)

type UserModel struct {
	Users map[int]*models.User

	UserByName map[string]*models.User

	InsertErrByName map[string]error
	GetErrByID      map[int]error

	NextID int

	Now func() time.Time
}

// muistinsisäinen mock user modelista joka toteuttaa user model interfacen backend sovelluksen testausta varten
func NewUserModelMock() *UserModel {
	now := time.Now
	m := &UserModel{
		Users:           make(map[int]*models.User),
		UserByName:      make(map[string]*models.User),
		InsertErrByName: make(map[string]error),
		GetErrByID:      make(map[int]error),
		NextID:          1001,
		Now:             now,
	}

	seedPass, _ := bcrypt.GenerateFromPassword([]byte("password"), 12)
	u := &models.User{
		Id:             float64(m.NextID),
		Username:       "user1",
		Email:          "user1@example.com",
		HashedPassword: seedPass,
		CreateTime:     m.Now(),
	}
	m.Users[m.NextID] = u
	m.UserByName[u.Username] = u
	m.NextID++

	m.InsertErrByName["dupe@example.com"] = models.ErrDuplicateUsername

	return m
}

func (m *UserModel) Insert(username string, email string, password string) (int, error) {
	if err, ok := m.InsertErrByName[username]; ok {
		return 0, err
	}
	if _, exists := m.UserByName[username]; exists {
		return 0, models.ErrDuplicateUsername
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return 0, err
	}

	id := m.NextID
	m.NextID++

	u := &models.User{
		Id:             float64(id),
		Username:       username,
		Email:          email,
		HashedPassword: hashed,
		CreateTime:     m.Now(),
	}
	m.Users[id] = u
	m.UserByName[username] = u
	return id, nil
}

func (m *UserModel) Authenticate(username string, password string) (int, error) {
	u, ok := m.UserByName[username]
	if !ok {
		return 0, models.ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword(u.HashedPassword, []byte(password)); err != nil {
		return 0, models.ErrInvalidCredentials
	}
	return int(u.Id), nil
}

func (m *UserModel) Exists(id int) (bool, error) {
	_, ok := m.Users[id]
	return ok, nil
}

func (m *UserModel) Get(id int) (*models.User, error) {
	if err, ok := m.GetErrByID[id]; ok {
		return nil, err
	}
	u, ok := m.Users[id]
	if !ok {
		return nil, models.ErrNoRecord
	}
	c := *u
	return &c, nil
}
