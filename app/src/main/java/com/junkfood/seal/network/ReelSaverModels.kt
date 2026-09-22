package com.junkfood.seal.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Data-transfer objects for the ReelSaver Flask backend API. */

@Serializable
data class ReelUser(
    val id: String,
    val username: String? = null,
    val email: String? = null,
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    @SerialName("profile_image_url") val profileImageUrl: String? = null,
    @SerialName("auth_provider") val authProvider: String = "local",
    @SerialName("is_admin") val isAdmin: Boolean = false,
) {
    val displayName: String
        get() =
            listOfNotNull(firstName, lastName).joinToString(" ").ifBlank { null }
                ?: username ?: email ?: "User"
}

@Serializable
data class ReelDownloadRecord(
    val id: String,
    val url: String,
    val title: String = "",
    val thumbnail: String = "",
    val uploader: String = "",
    val duration: Int? = null,
    @SerialName("media_type") val mediaType: String = "video",
    val ext: String? = null,
    val filename: String? = null,
    val filesize: Long? = null,
    val status: String = "",
    val error: String? = null,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class ReelHistoryPage(
    val items: List<ReelDownloadRecord> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val perPage: Int = 20,
)

@Serializable
data class ReelStats(
    val total: Int = 0,
    val completed: Int = 0,
    val failed: Int = 0,
    val downloading: Int = 0,
    val audioCount: Int = 0,
    val videoCount: Int = 0,
    val totalSize: Long = 0,
    val recent: List<ReelDownloadRecord> = emptyList(),
)

@Serializable
data class AuthRequest(
    val username: String,
    val password: String,
    val email: String? = null,
)

@Serializable data class ErrorResponse(val error: String? = null)

/** Result wrapper so callers can handle auth/network errors without exceptions. */
sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>
    data class Error(val message: String, val code: Int? = null) : ApiResult<Nothing>
    data object Unauthorized : ApiResult<Nothing>
}
