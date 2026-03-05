package com.guardian.android.data.api

import android.util.Log
import com.guardian.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ApiClient {
    private const val TAG = "ApiClient"
    private val baseUrl get() = BuildConfig.API_BASE_URL
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    suspend fun login(email: String, password: String): Result<Pair<String, String>> = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("email", email)
                put("password", password)
            }.toString()
            val req = Request.Builder()
                .url("$baseUrl/api/v1/auth/login")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            val resp = client.newCall(req).execute()
            if (!resp.isSuccessful) {
                return@withContext Result.failure(Exception("Login failed: ${resp.code}"))
            }
            val json = JSONObject(resp.body?.string() ?: "{}")
            val token = json.optString("token")
            val user = json.optJSONObject("user") ?: JSONObject()
            val userId = user.optString("id")
            if (token.isBlank()) return@withContext Result.failure(Exception("No token"))
            Result.success(token to userId)
        } catch (e: Exception) {
            Log.e(TAG, "login", e)
            Result.failure(e)
        }
    }

    suspend fun register(
        email: String,
        password: String,
        firstName: String,
        lastName: String
    ): Result<Pair<String, String>> = withContext(Dispatchers.IO) {
        try {
            val body = JSONObject().apply {
                put("email", email)
                put("password", password)
                put("first_name", firstName)
                put("last_name", lastName)
            }.toString()
            val req = Request.Builder()
                .url("$baseUrl/api/v1/auth/register")
                .post(body.toRequestBody("application/json".toMediaType()))
                .build()
            val resp = client.newCall(req).execute()
            if (!resp.isSuccessful) {
                return@withContext Result.failure(Exception("Registration failed: ${resp.code}"))
            }
            val json = JSONObject(resp.body?.string() ?: "{}")
            val token = json.optString("token")
            val user = json.optJSONObject("user") ?: JSONObject()
            val userId = user.optString("id")
            if (token.isBlank()) return@withContext Result.failure(Exception("No token"))
            Result.success(token to userId)
        } catch (e: Exception) {
            Log.e(TAG, "register", e)
            Result.failure(e)
        }
    }

    suspend fun getOrders(token: String): Result<List<OrderListItem>> = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url("$baseUrl/api/v1/orders")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()
            val resp = client.newCall(req).execute()
            if (!resp.isSuccessful) {
                return@withContext Result.failure(Exception("Orders failed: ${resp.code}"))
            }
            val json = JSONObject(resp.body?.string() ?: "{}")
            val arr = json.optJSONArray("orders") ?: org.json.JSONArray()
            val list = mutableListOf<OrderListItem>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                list.add(
                    OrderListItem(
                        id = o.optString("id"),
                        title = o.optString("title"),
                        status = o.optString("status", "unknown")
                    )
                )
            }
            Result.success(list)
        } catch (e: Exception) {
            Log.e(TAG, "getOrders", e)
            Result.failure(e)
        }
    }
}

data class OrderListItem(val id: String, val title: String, val status: String)
