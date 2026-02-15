use sqlx::postgres::PgPool;
use uuid::Uuid;
use rust_decimal::Decimal;

#[derive(Debug, Clone)]
pub struct LoyaltyService {
    pool: PgPool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Balance {
    pub balance: i64,
    pub locked: i64,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LedgerEntry {
    pub id: Uuid,
    pub user_id: i64,
    pub amount: i64,
    pub direction: String,
    pub source: String,
    pub reference: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum LoyaltyError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Insufficient balance")]
    InsufficientBalance,
    #[error("Verification required")]
    VerificationRequired,
}

impl LoyaltyService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_stats(&self) -> Result<(i64, i64, Decimal, Decimal, i32), LoyaltyError> {
        let (supply_total, supply_circulating, reserve_opt, rate_opt, percent_opt): (
            i64,
            i64,
            Option<Decimal>,
            Option<Decimal>,
            Option<i32>,
        ) = sqlx::query_as::<_, (i64, i64, Option<Decimal>, Option<Decimal>, Option<i32>)>(
            "SELECT supply_total, supply_circulating, reserve_usd, rate_usd, revenue_percent FROM loyalty_economy WHERE id = 1",
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e: sqlx::Error| LoyaltyError::Database(e.to_string()))?;

        let reserve: Decimal = reserve_opt.unwrap_or(Decimal::ZERO);
        let rate: Decimal = rate_opt.unwrap_or(Decimal::ZERO);
        let percent: i32 = percent_opt.unwrap_or(10i32);

        Ok((supply_total, supply_circulating, reserve, rate, percent))
    }

    async fn update_rate(&self) -> Result<(), LoyaltyError> {
        let (circ, reserve_opt): (i64, Option<Decimal>) =
            sqlx::query_as::<_, (i64, Option<Decimal>)>("SELECT supply_circulating, reserve_usd FROM loyalty_economy WHERE id = 1")
                .fetch_one(&self.pool)
                .await
                .map_err(|e: sqlx::Error| LoyaltyError::Database(e.to_string()))?;

        let reserve: Decimal = reserve_opt.unwrap_or(Decimal::ZERO);
        let denom = if circ <= 0 { Decimal::ONE } else { Decimal::from_i128_with_scale(circ as i128, 0) };
        let mut rate = reserve / denom;
        let one = Decimal::from_str_exact("1").unwrap();
        if rate < one && reserve > Decimal::ZERO {
            rate = reserve / denom;
        }
        sqlx::query("UPDATE loyalty_economy SET rate_usd = $1, updated_at = NOW() WHERE id = 1")
            .bind(rate)
            .execute(&self.pool)
            .await
            .map_err(|e: sqlx::Error| LoyaltyError::Database(e.to_string()))?;
        Ok(())
    }

    pub async fn inject_revenue(&self, amount_usd: Decimal) -> Result<(), LoyaltyError> {
        sqlx::query("UPDATE loyalty_economy SET reserve_usd = reserve_usd + $1, updated_at = NOW() WHERE id = 1")
            .bind(amount_usd)
            .execute(&self.pool)
            .await
            .map_err(|e: sqlx::Error| LoyaltyError::Database(e.to_string()))?;
        self.update_rate().await
    }

    pub async fn get_balance(&self, user_id: i64) -> Result<Balance, LoyaltyError> {
        let row = sqlx::query_as::<_, (i64, i64, Option<chrono::DateTime<chrono::Utc>>)>(
            "SELECT balance, locked, updated_at FROM loyalty_balances WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        if let Some((balance, locked, updated_at)) = row {
            Ok(Balance { balance, locked, updated_at })
        } else {
            Ok(Balance { balance: 0, locked: 0, updated_at: None })
        }
    }

    pub async fn list_ledger(&self, user_id: i64, limit: i64) -> Result<Vec<LedgerEntry>, LoyaltyError> {
        let rows = sqlx::query_as::<_, (Uuid, i64, i64, String, String, Option<String>, Option<chrono::DateTime<chrono::Utc>>)>(
            "SELECT id, user_id, amount, direction, source, reference, created_at FROM loyalty_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(|(id, user_id, amount, direction, source, reference, created_at)| LedgerEntry {
                id,
                user_id,
                amount,
                direction,
                source,
                reference,
                created_at,
            })
            .collect())
    }

    pub async fn earn(&self, user_id: i64, amount: i64, source: &str, reference: Option<&str>) -> Result<Balance, LoyaltyError> {
        let mut tx = self.pool.begin().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let (supply_total, supply_circulating) =
            sqlx::query_as::<_, (i64, i64)>("SELECT supply_total, supply_circulating FROM loyalty_economy WHERE id = 1")
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        let remaining = supply_total - supply_circulating;
        if amount > remaining {
            return Err(LoyaltyError::Database("Supply cap exceeded".into()));
        }

        sqlx::query(
            r#"
            INSERT INTO loyalty_balances (user_id, balance, locked)
            VALUES ($1, $2, 0)
            ON CONFLICT (user_id) DO UPDATE
            SET balance = loyalty_balances.balance + EXCLUDED.balance,
                updated_at = NOW()
            "#
        )
        .bind(user_id)
        .bind(amount)
        .execute(&mut *tx)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO loyalty_ledger (user_id, amount, direction, source, reference)
            VALUES ($1, $2, 'credit', $3, $4)
            "#
        )
        .bind(user_id)
        .bind(amount)
        .bind(source)
        .bind(reference)
        .execute(&mut *tx)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        sqlx::query("UPDATE loyalty_economy SET supply_circulating = supply_circulating + $1, updated_at = NOW() WHERE id = 1")
            .bind(amount)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        tx.commit().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;
        self.get_balance(user_id).await
    }

    pub async fn redeem(&self, user_id: i64, amount: i64, kind: &str) -> Result<Balance, LoyaltyError> {
        let mut tx = self.pool.begin().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let bal = sqlx::query_as::<_, (i64,)>("SELECT balance FROM loyalty_balances WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let current = bal.map(|b| b.0).unwrap_or(0);
        if current < amount {
            return Err(LoyaltyError::InsufficientBalance);
        }

        let (verified_level_opt,) = sqlx::query_as::<_, (Option<i32>,)>("SELECT verified_level FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        if verified_level_opt.unwrap_or(0) < 2 {
            return Err(LoyaltyError::VerificationRequired);
        }

        sqlx::query(
            r#"
            INSERT INTO loyalty_redemptions (user_id, amount, kind, status)
            VALUES ($1, $2, $3, 'pending')
            "#
        )
        .bind(user_id)
        .bind(amount)
        .bind(kind)
        .execute(&mut *tx)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        sqlx::query(
            r#"
            UPDATE loyalty_balances
            SET balance = balance - $2,
                locked = locked + $2,
                updated_at = NOW()
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .bind(amount)
        .execute(&mut *tx)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let reference: Option<String> = Some(kind.to_string());
        sqlx::query(
            r#"
            INSERT INTO loyalty_ledger (user_id, amount, direction, source, reference)
            VALUES ($1, $2, 'debit', 'redeem', $3)
            "#
        )
        .bind(user_id)
        .bind(amount)
        .bind(reference)
        .execute(&mut *tx)
        .await
        .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        tx.commit().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;
        self.get_balance(user_id).await
    }

    pub async fn process_referral(&self, referrer_id: i64, referee_id: i64) -> Result<i64, LoyaltyError> {
        let mut tx = self.pool.begin().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let exists = sqlx::query_as::<_, (i32,)>("SELECT 1 FROM loyalty_referrals WHERE referee_id = $1")
            .bind(referee_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        if exists.is_some() {
            return Err(LoyaltyError::Database("Referral already processed".into()));
        }

        let (total_count,) = sqlx::query_as::<_, (i64,)>("SELECT total_count FROM loyalty_referrals_stats WHERE id = 1")
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        let next = total_count + 1;

        let reward = if next <= 1000 {
            100
        } else if next <= 10000 {
            50
        } else if next <= 100000 {
            25
        } else if next <= 500000 {
            10
        } else {
            10
        };

        sqlx::query("INSERT INTO loyalty_referrals (referrer_id, referee_id, reward, ordinal) VALUES ($1, $2, $3, $4)")
            .bind(referrer_id)
            .bind(referee_id)
            .bind(reward)
            .bind(next)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        sqlx::query("UPDATE loyalty_referrals_stats SET total_count = $1, updated_at = NOW() WHERE id = 1")
            .bind(next)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        let (supply_total, supply_circulating) = sqlx::query_as::<_, (i64, i64)>("SELECT supply_total, supply_circulating FROM loyalty_economy WHERE id = 1")
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        let remaining = supply_total - supply_circulating;
        let total_award = reward * 2;
        if total_award > remaining {
            return Err(LoyaltyError::Database("Supply cap exceeded".into()));
        }

        for user_id in [referrer_id, referee_id] {
            sqlx::query(
                r#"
                INSERT INTO loyalty_balances (user_id, balance, locked)
                VALUES ($1, $2, 0)
                ON CONFLICT (user_id) DO UPDATE
                SET balance = loyalty_balances.balance + EXCLUDED.balance,
                    updated_at = NOW()
                "#
            )
            .bind(user_id)
            .bind(reward)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

            let reference: Option<String> = Some(format!("ordinal:{}", next));
            sqlx::query(
                r#"
                INSERT INTO loyalty_ledger (user_id, amount, direction, source, reference)
                VALUES ($1, $2, 'credit', 'referral', $3)
                "#
            )
            .bind(user_id)
            .bind(reward)
            .bind(reference)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;
        }

        sqlx::query("UPDATE loyalty_economy SET supply_circulating = supply_circulating + $1, updated_at = NOW() WHERE id = 1")
            .bind(total_award)
            .execute(&mut *tx)
            .await
            .map_err(|e| LoyaltyError::Database(e.to_string()))?;

        tx.commit().await.map_err(|e| LoyaltyError::Database(e.to_string()))?;
        Ok(reward)
    }
}
