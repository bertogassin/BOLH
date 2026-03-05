package com.guardian.android.data.models

import java.util.UUID

enum class UserType {
    CLIENT, GUARD, AGENCY
}

data class User(
    val id: UUID,
    val email: String,
    val phone: String,
    val userType: UserType,
    val firstName: String,
    val lastName: String,
    val avatarUrl: String? = null,
    val verified: Boolean,
    val reputationScore: Double
)
