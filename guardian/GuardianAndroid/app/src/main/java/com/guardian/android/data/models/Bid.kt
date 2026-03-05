package com.guardian.android.data.models

import java.util.UUID

data class Bid(
    val id: UUID,
    val bidderType: UserType,
    val bidderId: UUID,
    val title: String,
    val description: String,
    val availableLicenses: List<LicenseType>,
    val workLocation: Location,
    val workRadius: Double,
    val pricePerHour: Double,
    val validUntil: java.time.Instant,
    val active: Boolean
)
