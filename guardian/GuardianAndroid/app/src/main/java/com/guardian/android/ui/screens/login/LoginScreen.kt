package com.guardian.android.ui.screens.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import java.net.ConnectException

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    onLogin: (email: String, password: String, onResult: (Result<Unit>) -> Unit) -> Unit,
    onRegister: (
        email: String,
        password: String,
        firstName: String,
        lastName: String,
        onResult: (Result<Unit>) -> Unit
    ) -> Unit
) {
    var isRegisterMode by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("BOLH SECURITY", style = MaterialTheme.typography.headlineSmall)
        Text(
            if (isRegisterMode) "Create an account and get started" else "Sign in to continue",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(16.dp))

        Row(modifier = Modifier.fillMaxWidth()) {
            AuthModeButton(
                title = "Sign in",
                active = !isRegisterMode,
                onClick = { isRegisterMode = false; error = null },
                modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.padding(4.dp))
            AuthModeButton(
                title = "Register",
                active = isRegisterMode,
                onClick = { isRegisterMode = true; error = null },
                modifier = Modifier.weight(1f)
            )
        }
        Spacer(modifier = Modifier.height(12.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                if (isRegisterMode) {
                    OutlinedTextField(
                        value = firstName,
                        onValueChange = { firstName = it; error = null },
                        label = { Text("First name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = lastName,
                        onValueChange = { lastName = it; error = null },
                        label = { Text("Last name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                }
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; error = null },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; error = null },
                    label = { Text("Password") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        error?.let {
            Spacer(modifier = Modifier.height(10.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        Spacer(modifier = Modifier.height(16.dp))
        if (loading) {
            Text("Loading...")
        } else {
            Button(
                onClick = {
                    if (email.isBlank() || password.isBlank()) return@Button
                    if (isRegisterMode && (firstName.isBlank() || lastName.isBlank())) return@Button
                    loading = true
                    error = null
                    val callback: (Result<Unit>) -> Unit = { result ->
                        loading = false
                        result.fold(
                            onSuccess = { onLoginSuccess() },
                            onFailure = { e ->
                                error = if (e is ConnectException || (e.message?.contains("Failed to connect") == true)) {
                                    "Server unavailable. Start API on your PC and connect USB."
                                } else {
                                    e.message ?: "Authorization failed"
                                }
                            }
                        )
                    }
                    if (isRegisterMode) {
                        onRegister(email, password, firstName, lastName, callback)
                    } else {
                        onLogin(email, password, callback)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = email.isNotBlank() && password.isNotBlank() && (!isRegisterMode || (firstName.isNotBlank() && lastName.isNotBlank()))
            ) {
                Text(if (isRegisterMode) "Create account" else "Sign in")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    isRegisterMode = !isRegisterMode
                    error = null
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (isRegisterMode) "Already have an account? Sign in" else "No account? Register")
            }
        }
    }
}

@Composable
private fun AuthModeButton(
    title: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .border(
                width = 1.dp,
                color = if (active) MaterialTheme.colorScheme.primary else Color.Transparent,
                shape = RoundedCornerShape(10.dp)
            ),
        shape = RoundedCornerShape(10.dp)
    ) {
        Text(title)
    }
}
