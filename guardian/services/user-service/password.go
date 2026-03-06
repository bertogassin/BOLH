package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    uint32 = 3
	argonMemory  uint32 = 64 * 1024
	argonThreads uint8  = 4
	argonKeyLen  uint32 = 32
	argonSaltLen int    = 16
)

func hashPassword(pass string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(pass), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		argonMemory,
		argonTime,
		argonThreads,
		encodedSalt,
		encodedHash,
	), nil
}

func verifyPassword(pass, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		legacy := argon2.IDKey([]byte(pass), []byte("guardian-user-svc"), 1, 64*1024, 4, 32)
		return subtle.ConstantTimeCompare(legacy, []byte(encoded)) == 1
	}
	var mem uint32
	var timeCost uint32
	var threads uint8
	_, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &mem, &timeCost, &threads)
	if err != nil {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false
	}
	if len(hash) == 0 {
		return false
	}
	computed := argon2.IDKey([]byte(pass), salt, timeCost, mem, threads, uint32(len(hash)))
	return subtle.ConstantTimeCompare(computed, hash) == 1
}

func isPHCArgon2Hash(encoded string) bool {
	return strings.HasPrefix(encoded, "$argon2id$")
}
