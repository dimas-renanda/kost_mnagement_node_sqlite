#!/bin/bash

BASE_URL="http://localhost:4000"

USERNAME="admin"
PASSWORD="s2a2026"

echo "Logging in..."

TOKEN=$(curl -s "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "Login failed!"
    exit 1
fi

echo "Login success."

########################################
# Helper Functions
########################################

create_room() {
    local NAME="$1"
    local TYPE="$2"
    local PRICE="$3"

    echo "Creating room $NAME"

    curl -s "$BASE_URL/api/rooms" \
      -H "Content-Type: application/json" \
      -H "x-admin-token: $TOKEN" \
      -d "{
        \"name\":\"$NAME\",
        \"type\":\"$TYPE\",
        \"price\":$PRICE,
        \"status\":\"available\"
      }" >/dev/null
}

get_room_id() {
    local NAME="$1"

    curl -s "$BASE_URL/api/rooms" \
      -H "x-admin-token: $TOKEN" \
      | jq -r ".[] | select(.name==\"$NAME\") | .id"
}

create_guest() {
    local FULLNAME="$1"
    local ROOMNAME="$2"

    ROOM_ID=$(get_room_id "$ROOMNAME")

    echo "Creating guest $FULLNAME -> Room $ROOMNAME"

    curl -s "$BASE_URL/api/guests" \
      -H "Content-Type: application/json" \
      -H "x-admin-token: $TOKEN" \
      -d "{
        \"fullName\":\"$FULLNAME\",
        \"roomId\":$ROOM_ID,
        \"status\":\"active\"
      }" >/dev/null
}

########################################
# Create Rooms
########################################

create_room "Room 1" AC 1200000
create_room "Room 2" FAN 800000
create_room "Room 3" FAN 800000
create_room "Room 4" AC 1200000
create_room "Room 5" AC 1200000
create_room "Room 6" AC 1200000
create_room "Room 7" FAN 800000
create_room "Room 8" AC 1200000
create_room "Room 9" FAN 800000
create_room "Room 10" AC 1200000
create_room "Room 11" FAN 800000
create_room "Room 12" FAN 800000
create_room "Room 13" FAN 800000
create_room "Room 14" FAN 800000
create_room "Room 15" AC 1200000
create_room "Room 16" AC 1200000

create_room "Room 301" FAN 800000
create_room "Room 302" FAN 800000
create_room "Room 303" FAN 800000
create_room "Room 304" FAN 800000
create_room "Room 305" FAN 800000
create_room "Room 306" FAN 800000
create_room "Room 307" FAN 800000

########################################
# Create Guests
########################################

create_guest "Koko" "Room 1"

create_guest "Rafi" "Room 2"
create_guest "Emir" "Room 2"

create_guest "Keyza" "Room 3"

create_guest "Wikan" "Room 4"

create_guest "Hanan" "Room 5"

create_guest "Vita" "Room 6"

create_guest "Jihan" "Room 7"
create_guest "Ilman" "Room 7"

create_guest "Martha" "Room 8"
create_guest "Agma" "Room 8"

create_guest "Faranita" "Room 9"

create_guest "Noval" "Room 10"

create_guest "Iman" "Room 11"

create_guest "Fahri" "Room 12"

create_guest "Artha" "Room 13"

create_guest "Fitri" "Room 16"

create_guest "Rivaldo" "Room 301"

create_guest "Jihan" "Room 302"

create_guest "Angka" "Room 303"

create_guest "Mariano" "Room 304"

create_guest "Dimas" "Room 306"
create_guest "Dimdim" "Room 306"

create_guest "Fahian" "Room 307"

echo
echo "==================================="
echo "All rooms and guests have been inserted."
echo "==================================="