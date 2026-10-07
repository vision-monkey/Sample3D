package com.example.hapticlab.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hapticlab.R
import com.example.hapticlab.data.HapticCategory
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.PlaybackState
import com.example.hapticlab.ui.components.CapabilityCard
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
    onPlay: (HapticPattern) -> Unit,
    onStop: () -> Unit,
    onOpenPattern: (HapticPattern) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 96.dp),
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "header", span = { GridItemSpan(maxLineSpan) }) { Header(capability, state.totalCount) }
        item(key = "capability", span = { GridItemSpan(maxLineSpan) }) {
            CapabilityCard(capability, initiallyExpanded = false)
        }
        item(key = "search", span = { GridItemSpan(maxLineSpan) }) {
            OutlinedTextField(
                value = state.query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("진동 찾기...") },
                leadingIcon = { Text("🔍") },
                trailingIcon = {
                    if (state.query.isNotEmpty()) {
                        TextButton(onClick = { onQueryChange("") }) { Text("지우기") }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
        }
        item(key = "filters", span = { GridItemSpan(maxLineSpan) }) {
            CategoryFilterRow(
                selected = state.category,
                favoritesOnly = state.favoritesOnly,
                favoriteCount = state.favorites.size,
                onCategorySelected = onCategorySelected,
                onFavoritesOnlyChange = onFavoritesOnlyChange,
            )
        }
        item(key = "count", span = { GridItemSpan(maxLineSpan) }) {
            Text(
                "${state.patterns.size}/${state.totalCount}개 · 누르면 진동, 길게 누르면 자세히",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state.patterns.isEmpty()) {
            item(key = "empty", span = { GridItemSpan(maxLineSpan) }) { EmptyState(state.favoritesOnly) }
        }
        items(state.patterns, key = { it.id }) { pattern ->
            val playingThis = playback.isPlaying && playback.sourceId == pattern.id
            PatternTile(
                pattern = pattern,
                isPlaying = playingThis,
                onClick = { if (playingThis) onStop() else onPlay(pattern) },
                onLongClick = { onOpenPattern(pattern) },
            )
        }
    }
}

@Composable
private fun Header(capability: HapticCapability, total: Int) {
    Column(Modifier.padding(top = 8.dp, bottom = 4.dp)) {
        Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(2.dp))
        Text(
            capability.displayName,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            "${total}가지 진동",
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
                label = { Text(if (favoritesOnly) "★ 즐겨찾기 ($favoriteCount)" else "☆ 즐겨찾기") },
            )
        }
        item {
            FilterChip(
                selected = selected == null,
                onClick = { onCategorySelected(null) },
                label = { Text("전체") },
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
            if (favoritesOnly) "아직 즐겨찾기가 없어요. 진동을 길게 눌러 ☆을 눌러 보세요." else "찾는 진동이 없어요.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Compact grid tile: icon, number and name only. Tap plays, long-press opens the detail screen. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PatternTile(
    pattern: HapticPattern,
    isPlaying: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(16.dp)
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(0.95f)
            .clip(shape)
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
        shape = shape,
        color = if (isPlaying) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = BorderStroke(
            width = if (isPlaying) 2.dp else 1.dp,
            color = if (isPlaying) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Box(Modifier.padding(8.dp)) {
            Text(
                "${pattern.number}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.TopStart),
            )
            Column(
                Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(pattern.emoji, fontSize = 30.sp)
                Spacer(Modifier.height(6.dp))
                Text(
                    pattern.name,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    minLines = 2,
                )
            }
        }
    }
}
