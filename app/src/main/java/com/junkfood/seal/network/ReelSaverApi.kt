package com.junkfood.seal.network

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Thin client for the ReelSaver Flask backend. Uses a persistent cookie jar so
 * the session established by /auth/login is reused for subsequent /api calls.
 */
object ReelSaverApi {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    val cookieJar = PersistentCookieJar()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private fun url(path: String): String = ReelSaverConfig.baseUrl.trimEnd('/') + path

    // ─── Auth ────────────────────────────────────────────────────────────────

    suspend fun login(username: String, password: String): ApiResult<ReelUser> =
        postJson("/auth/login", AuthRequest(username = username, password = password))

    suspend fun register(username: String, password: String, email: String?): ApiResult<ReelUser> =
        postJson(
            "/auth/register",
            AuthRequest(username = username, password = password, email = email?.ifBlank { null }),
        )

    suspend fun logout(): ApiResult<Unit> =
        withContext(Dispatchers.IO) {
            val req = Request.Builder().url(url("/auth/logout")).get().build()
            runCatching { client.newCall(req).execute().use {} }
            cookieJar.clear()
            ApiResult.Success(Unit)
        }

    suspend fun me(): ApiResult<ReelUser> = getJson("/api/me", ReelUser.serializer())

    // ─── Data ────────────────────────────────────────────────────────────────

    suspend fun stats(): ApiResult<ReelStats> = getJson("/api/stats", ReelStats.serializer())

    suspend fun history(search: String = "", type: String = "", page: Int = 1): ApiResult<ReelHistoryPage> {
        val query = buildString {
            append("/api/history?page=").append(page).append("&perPage=20")
            if (search.isNotBlank()) append("&search=").append(search)
            if (type.isNotBlank()) append("&type=").append(type)
        }
        return getJson(query, ReelHistoryPage.serializer())
    }

    // ─── Internals ─────────────────────────────────────────────────────────────

    private suspend fun <T> getJson(
        path: String,
        deserializer: kotlinx.serialization.KSerializer<T>,
    ): ApiResult<T> =
        withContext(Dispatchers.IO) {
            if (!ReelSaverConfig.isConfigured) return@withContext ApiResult.Error("Backend URL not set")
            val req = Request.Builder().url(url(path)).get().build()
            execute(req) { body -> json.decodeFromString(deserializer, body) }
        }

    private suspend fun postJson(path: String, body: AuthRequest): ApiResult<ReelUser> =
        withContext(Dispatchers.IO) {
            if (!ReelSaverConfig.isConfigured) return@withContext ApiResult.Error("Backend URL not set")
            val payload =
                json.encodeToString(AuthRequest.serializer(), body).toRequestBody(jsonMedia)
            val req = Request.Builder().url(url(path)).post(payload).build()
            execute(req) { respBody -> json.decodeFromString(ReelUser.serializer(), respBody) }
        }

    private inline fun <T> execute(request: Request, parse: (String) -> T): ApiResult<T> =
        try {
            client.newCall(request).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                when {
                    resp.code == 401 -> ApiResult.Unauthorized
                    resp.isSuccessful -> ApiResult.Success(parse(body))
                    else -> ApiResult.Error(parseError(body) ?: "Request failed", resp.code)
                }
            }
        } catch (e: IOException) {
            ApiResult.Error(e.message ?: "Network error")
        } catch (e: Exception) {
            ApiResult.Error(e.message ?: "Unexpected error")
        }

    private fun parseError(body: String): String? =
        runCatching { json.decodeFromString(ErrorResponse.serializer(), body).error }.getOrNull()
}
