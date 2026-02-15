//! Validation module
//! 
//! Phone, email, IIN, card validation

use regex::Regex;
use serde::{Deserialize, Serialize};

pub struct ValidationService;

impl ValidationService {
    /// Validate Kazakhstan phone number (+7 7XX XXX XXXX)
    pub fn validate_phone_kz(phone: &str) -> bool {
        let cleaned: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
        
        if cleaned.len() == 11 && cleaned.starts_with('7') {
            let operator = &cleaned[1..4];
            let valid_operators = ["700", "701", "702", "703", "704", "705", "706", "707", "708", "709",
                                   "747", "750", "751", "760", "761", "762", "763", "764", "771", "775",
                                   "776", "777", "778"];
            return valid_operators.contains(&operator);
        }
        
        if cleaned.len() == 10 && cleaned.starts_with('7') {
            return true;
        }
        
        false
    }

    /// Validate email address
    pub fn validate_email(email: &str) -> bool {
        let email_regex = Regex::new(
            r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        ).unwrap();
        email_regex.is_match(email)
    }

    /// Validate Kazakhstan IIN (Individual Identification Number)
    pub fn validate_iin(iin: &str) -> bool {
        if iin.len() != 12 || !iin.chars().all(|c| c.is_ascii_digit()) {
            return false;
        }

        let digits: Vec<u32> = iin.chars().map(|c| c.to_digit(10).unwrap()).collect();

        // Check birth date validity
        let _year = digits[0] * 10 + digits[1];
        let month = digits[2] * 10 + digits[3];
        let day = digits[4] * 10 + digits[5];
        let century_gender = digits[6];

        if month < 1 || month > 12 || day < 1 || day > 31 {
            return false;
        }

        if century_gender < 1 || century_gender > 6 {
            return false;
        }

        // Calculate checksum
        let weights1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        let weights2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

        let sum1: u32 = digits.iter().take(11).zip(&weights1).map(|(d, w)| d * w).sum();
        let mut control = sum1 % 11;

        if control == 10 {
            let sum2: u32 = digits.iter().take(11).zip(&weights2).map(|(d, w)| d * w).sum();
            control = sum2 % 11;
        }

        control == digits[11]
    }

    /// Validate card number using Luhn algorithm
    pub fn validate_card(card: &str) -> bool {
        let cleaned: String = card.chars().filter(|c| c.is_ascii_digit()).collect();
        
        if cleaned.len() < 13 || cleaned.len() > 19 {
            return false;
        }

        let digits: Vec<u32> = cleaned.chars().map(|c| c.to_digit(10).unwrap()).collect();
        
        let sum: u32 = digits
            .iter()
            .rev()
            .enumerate()
            .map(|(i, &d)| {
                if i % 2 == 1 {
                    let doubled = d * 2;
                    if doubled > 9 { doubled - 9 } else { doubled }
                } else {
                    d
                }
            })
            .sum();

        sum % 10 == 0
    }

    /// Validate URL
    pub fn validate_url(url: &str) -> bool {
        let url_regex = Regex::new(
            r"^https?://[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+(/[^\s]*)?$"
        ).unwrap();
        url_regex.is_match(url)
    }

    /// Check password strength
    pub fn check_password_strength(password: &str) -> PasswordStrength {
        let length = password.len();
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        let has_digit = password.chars().any(|c| c.is_ascii_digit());
        let has_special = password.chars().any(|c| !c.is_alphanumeric());

        let mut score = 0;
        if length >= 8 { score += 1; }
        if length >= 12 { score += 1; }
        if length >= 16 { score += 1; }
        if has_lowercase { score += 1; }
        if has_uppercase { score += 1; }
        if has_digit { score += 1; }
        if has_special { score += 1; }

        let level = match score {
            0..=2 => StrengthLevel::Weak,
            3..=4 => StrengthLevel::Medium,
            5..=6 => StrengthLevel::Strong,
            _ => StrengthLevel::VeryStrong,
        };

        PasswordStrength {
            level,
            score,
            has_lowercase,
            has_uppercase,
            has_digit,
            has_special,
            length,
        }
    }

    /// Validate username (alphanumeric, underscore, 3-20 chars)
    pub fn validate_username(username: &str) -> bool {
        let username_regex = Regex::new(r"^[a-zA-Z][a-zA-Z0-9_]{2,19}$").unwrap();
        username_regex.is_match(username)
    }

    /// Sanitize input string
    pub fn sanitize(input: &str) -> String {
        input
            .chars()
            .filter(|c| !c.is_control())
            .map(|c| match c {
                '<' => "&lt;".chars().collect::<Vec<_>>(),
                '>' => "&gt;".chars().collect::<Vec<_>>(),
                '&' => "&amp;".chars().collect::<Vec<_>>(),
                '"' => "&quot;".chars().collect::<Vec<_>>(),
                '\'' => "&#x27;".chars().collect::<Vec<_>>(),
                _ => vec![c],
            })
            .flatten()
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrengthLevel {
    Weak,
    Medium,
    Strong,
    VeryStrong,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordStrength {
    pub level: StrengthLevel,
    pub score: u8,
    pub has_lowercase: bool,
    pub has_uppercase: bool,
    pub has_digit: bool,
    pub has_special: bool,
    pub length: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_phone_validation() {
        assert!(ValidationService::validate_phone_kz("+77071234567"));
        assert!(ValidationService::validate_phone_kz("87071234567"));
        assert!(!ValidationService::validate_phone_kz("1234567890"));
    }

    #[test]
    fn test_email_validation() {
        assert!(ValidationService::validate_email("test@example.com"));
        assert!(ValidationService::validate_email("user.name@domain.co.uk"));
        assert!(!ValidationService::validate_email("invalid-email"));
    }

    #[test]
    fn test_card_validation() {
        // Test valid Luhn numbers
        assert!(ValidationService::validate_card("4532015112830366"));
        assert!(!ValidationService::validate_card("1234567890123456"));
    }

    #[test]
    fn test_password_strength() {
        let weak = ValidationService::check_password_strength("123");
        assert_eq!(weak.level, StrengthLevel::Weak);

        let strong = ValidationService::check_password_strength("MyP@ssw0rd123!");
        assert_eq!(strong.level, StrengthLevel::VeryStrong);
    }
}
