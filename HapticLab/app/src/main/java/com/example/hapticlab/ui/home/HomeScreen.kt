package com.example.hapticlab.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hapticlab.data.HapticCategory
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.PlaybackState
import com.example.hapticlab.ui.components.CapabilityCard
import com.example.hapticlab.ui.theme.MonoStyle
import com.example.hapticlab.viewmodel.HomeUiState
import com.example.hapticlab.viewmodel.HomeViewModel

@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onOpenPattern: (HapticPattern) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val playback by viewModel.playback.collectAsStateWithLifecycle()
    HomeContent(
        state = state,
        capability = viewModel.capability,
        playback = playback,
        onQueryChange = viewModel::onQueryChange,
        onCategorySelected = viewModel::onCategorySelected,
        onFavoritesOnlyChange = viewModel::onFavoritesOnlyChange,
        onToggleFavorite = viewModel::toggleFavorite,
        onPlay = viewModel::play,
        onStop = viewModel::stop,
        onOpenPattern = onOpenPattern,
        modifier = modifier,
    )
}

@Composable
fun HomeContent(
    state: HomeUiState,
    capability: HapticCapability,
    playback: PlaybackState,
    onQueryChange: (String) -> Unit,
    onCategorySelected: (HapticCategory?) -> Unit,
    onFavoritesOnlyChange: (Boolean) -> Unit,
    onToggleFavorite: (String) -> Unit,
    onPlay: (HapticPattern) -> Unit,
    onStop: () -> Unit,
    onOpenPattern: (HapticPattern) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "header") { Header(capability, state.totalCount) }
        item(key = "capability") { CapabilityCard(capability) }
        item(key = "search") {
            OutlinedTextField(
                value = state.query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search haptics...") },
                leadingIcon = { Text("🔍") },
                trailingIcon = {
                    if (state.query.isNotEmpty()) {
                        TextButton(onClick = { onQueryChange("") }) { Text("Clear") }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
        }
        item(key = "filters") {
            CategoryFilterRow(
                selected = state.category,
                favoritesOnly = state.favoritesOnly,
                favoriteCount = state.favorites.size,
                onCategorySelected = onCategorySelected,
                onFavoritesOnlyChange = onFavoritesOnlyChange,
            )
        }
        item(key = "count") {
            Text(
                "${state.patterns.size} of ${state.totalCount} patterns",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.patterns.isEmpty()) {
            item(key = "empty") { EmptyState(state.favoritesOnly) }
        }
        items(state.patterns, key = { it.id }) { pattern ->
            val playingThis = playback.isPlaying && playback.sourceId == pattern.id
            PatternCard(
                pattern = pattern,
                isFavorite = pattern.id in state.favorites,
                isPlaying = playingThis,
                onClick = { onOpenPattern(pattern) },
                onPlay = { if (playingThis) onStop() else onPlay(pattern) },
                onToggleFavorite = { onToggleFavorite(pattern.id) },
            )
        }
    }
}

@Composable
private fun Header(capability: HapticCapability, total: Int) {
    Column(Modifier.padding(top = 8.dp, bottom = 4.dp)) {
        Text("Haptic Lab", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(2.dp))
        Text(
            capability.displayName,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            "$total Haptic Experiences",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun CategoryFilterRow(
    selected: HapticCategory?,
    favoritesOnly: Boolean,
    favoriteCount: Int,
    onCategorySelected: (HapticCategory?) -> Unit,
    onFavoritesOnlyChange: (Boolean) -> Unit,
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            FilterChip(
                selected = favoritesOnly,
                onClick = { onFavoritesOnlyChange(!favoritesOnly) },
                label = { Text(if (favoritesOnly) "★ Favorites ($favoriteCount)" else "☆ Favorites") },
            )
        }
        item {
            FilterChip(
                selected = selected == null,
                onClick = { onCategorySelected(null) },
                label = { Text("All") },
            )
        }
        items(HapticCategory.entries) { category ->
            FilterChip(
                selected = selected == category,
                onClick = { onCategorySelected(category) },
                label = { Text(category.label) },
            )
        }
    }
}

@Composable
private fun EmptyState(favoritesOnly: Boolean) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(if (favoritesOnly) "☆" else "🔍", fontSize = 40.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            if (favoritesOnly) "No favorites yet. Tap ☆ on a pattern to add it." else "No haptics match your search.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun PatternCard(
    pattern: HapticPattern,
    isFavorite: Boolean,
    isPlaying: Boolean,
    onClick: () -> Unit,
    onPlay: () -> Unit,
    onToggleFavorite: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(start = 16.dp, top = 14.dp, end = 8.dp, bottom = 14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(pattern.emoji, fontSize = 22.sp)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        "${pattern.number}. ${pattern.name}",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        pattern.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = onToggleFavorite) {
                    Text(
                        if (isFavorite) "★" else "☆",
                        fontSize = 22.sp,
                        color = if (isFavorite) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        pattern.sequenceSummary,
                        style = MonoStyle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "${pattern.category.label} · ~${pattern.estimatedDurationMs} ms",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.width(8.dp))
                FilledTonalButton(
                    onClick = onPlay,
                    modifier = Modifier
                        .padding(end = 8.dp)
                        .height(44.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        if (isPlaying) "■ STOP" else "▶ PLAY",
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}
