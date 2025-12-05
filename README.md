# Käyttöönotto
Projekti koostuu tietokannasta, peli-clientistä sekä go backendistä.

## Tietokanta
Tietokannan käynnistykseen löytyy ohjeet [täältä](https://github.com/jonnevuorela/fullstack-project/blob/main/mariadb-docker/readme.md#k%C3%A4ytt%C3%B6%C3%B6notto).

## Peli-client
Peli-client täytyy niputtaa käyttämällä Viteä, joka huolehtii tarvittavat tiedostot oikeaan paikkaan, josta backend löytää ne.
Peli-clientin käyttöönotosta löytyy ohjeet [täältä](https://github.com/jonnevuorela/fullstack-project/tree/main/game#readme)

## Go backend
Backend tarvitsee ympäristömuuttujia, joita se etsii projektin juuressa olevasta .env tiedostosta.
### Esimerkki .env tiedosto
``` .env
DB_NAME="fullstack_project"
DB_USER="client"
DB_PASS="pass"
DB_PORT=3306

DB_TEST_NAME="test_fullstack_project"
DB_TEST_USER="test_client"
DB_TEST_PASS="pass"
DB_TEST_PORT=3306
```
Projekti on configuroitu käyttämään tls sertifikaattia tls nimisestä hakemistosta projektin juuresta.
```
tls
├── cert.pem
└── key.pem
```
Riippuen tarpeestä tämän voi luoda ja allekirjoittaa esimerkiksi itse komennolla.
``` bash
mkcert -key-file tls/key.pem -cert-file tls/cert.pem localhost 127.0.0.1 ::1 0.0.0.0
```
Kun ympäristömuuttujat, tls sertifikaatit, [tietokanta](https://github.com/jonnevuorela/fullstack-project/blob/main/mariadb-docker/readme.md#k%C3%A4ytt%C3%B6%C3%B6notto) ja [peli-client](https://github.com/jonnevuorela/fullstack-project/tree/main/game#readme) on valmisteltu, voidaan käynnistää backend seuraavalla komennolla.
``` bash
go run ./cmd/*
```
Mikäli kaikki vaiheet on onnistunut, serverin pitäisi käynnistyä portissa 4000. [https:localhost:4000/](https:localhost:4000/)

## Backendin testaaminen
Backendin testaamiseen on tehty jonkin verran integraatio- ja yksikkötestejä.
Testitiedostot on nimetty go-kielen nimeämiskäytännönmukaan *_test.go päätteellä. Go osaa hakea tällä nimeämiskäytännöllä nimettyjä tiedostoja kun ajetaan seuraava komento.
```
go test ./...
```
Tämä komento ajaa projektin kaikki testit.
