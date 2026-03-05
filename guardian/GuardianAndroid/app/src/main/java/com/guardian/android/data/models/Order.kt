package com.guardian.android.data.models

import java.util.UUID

data class Order(
    val id: UUID,
    val title: String,
    val description: String,
    val requiredLicenses: List<LicenseType>,
    val requiredExperience: Int,
    val guardCount: Int,
    val budgetMin: Double,
    val budgetMax: Double,
    val location: Location,
    val startTime: java.time.Instant,
    val endTime: java.time.Instant,
    val status: OrderStatus
)

enum class OrderStatus {
    OPEN, MATCHING, MATCHED, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED;

    val displayName: String
        get() = when (this) {
            OPEN -> "Open"
            MATCHING -> "Matching"
            MATCHED -> "Guard assigned"
            ACCEPTED -> "Accepted"
            IN_PROGRESS -> "In progress"
            COMPLETED -> "Completed"
            CANCELLED -> "Cancelled"
        }
}

data class Location(
    val latitude: Double,
    val longitude: Double,
    val address: String? = null
)

enum class LicenseType {
    WEAPON, MEDICAL, DRIVING, AVIATION, MARITIME,
    CROWD_CONTROL, K9, TECHNICAL, SECURITY, OTHER
}
