package com.junkfood.seal.network

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Holds ReelSaver account/session state and exposes it to the UI. */
object ReelSaverAccountRepository {

    private val _user = MutableStateFlow<ReelUser?>(null)
    val user: StateFlow<ReelUser?> = _user.asStateFlow()

    val isSignedIn: Boolean
        get() = _user.value != null

    /** Refresh the current user from an existing session cookie, if any. */
    suspend fun refresh(): ApiResult<ReelUser> {
        if (!ReelSaverConfig.isConfigured) return ApiResult.Error("Backend URL not set")
        return when (val res = ReelSaverApi.me()) {
            is ApiResult.Success -> {
                _user.value = res.data
                res
            }
            is ApiResult.Unauthorized -> {
                _user.value = null
                res
            }
            is ApiResult.Error -> res
        }
    }

    suspend fun login(username: String, password: String): ApiResult<ReelUser> =
        ReelSaverApi.login(username, password).also { if (it is ApiResult.Success) _user.value = it.data }

    suspend fun register(username: String, password: String, email: String?): ApiResult<ReelUser> =
        ReelSaverApi.register(username, password, email).also {
            if (it is ApiResult.Success) _user.value = it.data
        }

    suspend fun logout() {
        ReelSaverApi.logout()
        _user.value = null
    }
}
