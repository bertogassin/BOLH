// Инварианты заказа: бюджет не ниже минимальной ставки, клиент не видит цены.

use bolh_domain::*;
use rust_decimal::Decimal;
use uuid::Uuid;

fn money(amount: i64) -> Money {
    Money::new(Decimal::from(amount), Currency::Rub).unwrap()
}

#[test]
fn order_create_rejects_budget_below_minimum() {
    let min = money(50);
    let max = money(50); // ниже 100
    let budget = MoneyRange { min, max };
    let err = Order::create(
        Uuid::new_v4(),
        Uuid::new_v4(),
        Requirements::default(),
        budget,
        Visibility::All,
    )
    .unwrap_err();
    assert_eq!(err, DomainError::BudgetTooLow);
}

#[test]
fn order_create_accepts_valid_budget() {
    let budget = MoneyRange {
        min: money(100),
        max: money(500),
    };
    let order = Order::create(
        Uuid::new_v4(),
        Uuid::new_v4(),
        Requirements::default(),
        budget,
        Visibility::All,
    )
    .unwrap();
    assert!(order.actual_price.is_none());
    assert_eq!(order.status, OrderStatus::Active);
}

#[test]
fn order_view_hides_actual_price_and_budget() {
    let budget = MoneyRange {
        min: money(200),
        max: money(1000),
    };
    let order = Order::create(
        Uuid::new_v4(),
        Uuid::new_v4(),
        Requirements::default(),
        budget,
        Visibility::All,
    )
    .unwrap();
    let view = order.visible_to_client();
    assert_eq!(view.id, order.id);
    assert_eq!(view.status, order.status);
    // view не содержит budget и actual_price — только для клиента
}
