package com.guardian.android.ui.screens.home

import androidx.lifecycle.ViewModel
import com.guardian.android.data.api.ApiClient
import com.guardian.android.data.api.OrderListItem
import com.guardian.android.data.models.Bid
import com.guardian.android.data.models.Order
import com.guardian.android.data.models.User
import com.guardian.android.data.models.UserType
import com.guardian.android.data.prefs.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

data class HomeUiState(
    val isLoading: Boolean = false,
    val currentUser: User? = null,
    val userType: UserType = UserType.CLIENT,
    val activeOrders: List<Order> = emptyList(),
    val apiOrders: List<OrderListItem> = emptyList(),
    val activeBids: List<Bid> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null
)

class HomeViewModel(private val tokenStore: TokenStore) : ViewModel() {
    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    val currentUser: User?
        get() = _uiState.value.currentUser
    val userType: UserType
        get() = _uiState.value.userType
    val activeOrders: List<Order>
        get() = _uiState.value.activeOrders
    val apiOrders: List<OrderListItem>
        get() = _uiState.value.apiOrders
    val unreadCount: Int
        get() = _uiState.value.unreadCount

    init {
        _uiState.value = _uiState.value.copy(
            currentUser = User(
                id = UUID.randomUUID(),
                email = "user@example.com",
                phone = "",
                userType = UserType.CLIENT,
                firstName = "",
                lastName = "",
                avatarUrl = null,
                verified = false,
                reputationScore = 0.0
            ),
            userType = UserType.CLIENT
        )
        tokenStore.token?.let { token ->
            _uiState.value = _uiState.value.copy(isLoading = true)
            CoroutineScope(Dispatchers.Main).launch {
                ApiClient.getOrders(token).fold(
                    onSuccess = { list ->
                        _uiState.value = _uiState.value.copy(apiOrders = list, isLoading = false)
                    },
                    onFailure = {
                        _uiState.value = _uiState.value.copy(isLoading = false, error = it.message)
                    }
                )
            }
        }
    }
}
