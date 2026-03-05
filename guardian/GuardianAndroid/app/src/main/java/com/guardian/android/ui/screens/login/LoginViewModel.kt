package com.guardian.android.ui.screens.login

import androidx.lifecycle.ViewModel
import com.guardian.android.data.api.ApiClient
import com.guardian.android.data.prefs.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class LoginViewModel(private val tokenStore: TokenStore) : ViewModel() {

    fun login(email: String, password: String, onResult: (Result<Unit>) -> Unit) {
        CoroutineScope(Dispatchers.Main).launch {
            ApiClient.login(email, password).fold(
                onSuccess = { (token, _) ->
                    tokenStore.token = token
                    onResult(Result.success(Unit))
                },
                onFailure = { onResult(Result.failure(it)) }
            )
        }
    }

    fun register(
        email: String,
        password: String,
        firstName: String,
        lastName: String,
        onResult: (Result<Unit>) -> Unit
    ) {
        CoroutineScope(Dispatchers.Main).launch {
            ApiClient.register(email, password, firstName, lastName).fold(
                onSuccess = { (token, _) ->
                    tokenStore.token = token
                    onResult(Result.success(Unit))
                },
                onFailure = { onResult(Result.failure(it)) }
            )
        }
    }
}
