// Presentation: точка входа API.
// В продакшене здесь инициализация роутера, middleware, инъекция use cases.
package main

import (
	"log"
	"net/http"
	"os"

	"bolh-security/internal/user/application"
	"bolh-security/internal/user/infrastructure"
)

func main() {
	repo := infrastructure.NewMemoryUserRepository()
	createUser := application.NewCreateUserHandler(repo)

	http.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		email := r.FormValue("email")
		if email == "" {
			http.Error(w, "email required", http.StatusBadRequest)
			return
		}
		u, err := createUser.Handle(r.Context(), application.CreateUserCommand{Email: email})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(u.ID))
	})

	addr := os.Getenv("API_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	log.Printf("api listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
