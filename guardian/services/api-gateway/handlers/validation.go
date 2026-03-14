package handlers

import (
	"encoding/base64"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

var strictEmailRegex = regexp.MustCompile(`^[a-z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$`)
var freeEmailDomains = map[string]bool{
	"gmail.com":      true,
	"yahoo.com":      true,
	"hotmail.com":    true,
	"outlook.com":    true,
	"icloud.com":     true,
	"mail.ru":        true,
	"yandex.ru":      true,
	"proton.me":      true,
	"protonmail.com": true,
}

func normalizeEmailStrict(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func isStrictEmail(v string) bool {
	return strictEmailRegex.MatchString(normalizeEmailStrict(v))
}

func emailDomain(email string) string {
	e := normalizeEmailStrict(email)
	parts := strings.Split(e, "@")
	if len(parts) != 2 {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func isCorporateEmail(email string) bool {
	domain := emailDomain(email)
	if domain == "" {
		return false
	}
	return !freeEmailDomains[domain]
}

func normalizeName(v string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(v)), " ")
}

func isReasonableName(v string) bool {
	n := normalizeName(v)
	if len(n) < 2 || len(n) > 80 {
		return false
	}
	for _, r := range n {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) || r == '-' || r == '\'' {
			continue
		}
		return false
	}
	return true
}

func isFourDigits(v string) bool {
	if len(v) != 4 {
		return false
	}
	for _, r := range v {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func sanitizeCardBrand(v string) (string, bool) {
	b := strings.ToLower(strings.TrimSpace(v))
	if b == "" {
		return "card", true
	}
	switch b {
	case "visa", "mastercard", "amex", "discover", "jcb", "card":
		return b, true
	default:
		return "", false
	}
}

func onlyDigits(v string) string {
	var b strings.Builder
	for _, r := range v {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func isReasonablePhone(v string) bool {
	d := onlyDigits(v)
	return len(d) >= 8 && len(d) <= 15
}

func isReasonableWebsite(v string) bool {
	raw := strings.TrimSpace(v)
	if raw == "" {
		return true
	}
	candidate := raw
	if !strings.HasPrefix(strings.ToLower(candidate), "http://") && !strings.HasPrefix(strings.ToLower(candidate), "https://") {
		candidate = "https://" + candidate
	}
	u, err := url.Parse(candidate)
	if err != nil || u.Hostname() == "" {
		return false
	}
	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if !strings.Contains(host, ".") || host == "localhost" {
		return false
	}
	return true
}

func luhnCheck(digits string) bool {
	if digits == "" {
		return false
	}
	sum := 0
	double := false
	for i := len(digits) - 1; i >= 0; i-- {
		d := int(digits[i] - '0')
		if d < 0 || d > 9 {
			return false
		}
		if double {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		double = !double
	}
	return sum%10 == 0
}

func decodeBase64Payload(payload string) ([]byte, error) {
	clean := strings.TrimSpace(payload)
	if clean == "" {
		return nil, errors.New("empty payload")
	}
	if i := strings.Index(clean, ","); i >= 0 {
		clean = clean[i+1:]
	}
	out, err := base64.StdEncoding.DecodeString(clean)
	if err != nil {
		out, err = base64.RawStdEncoding.DecodeString(clean)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}
