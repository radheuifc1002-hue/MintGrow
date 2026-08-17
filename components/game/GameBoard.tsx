import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { useGame } from '@/hooks/useGame';
import { GameTile } from './GameTile';
import { Colors, Spacing, Radius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const BOARD_PADDING = 12;
const GAP = 8;
const BOARD_SIZE = 4;
const TILE_SIZE = Math.floor((Math.min(width, 400) - BOARD_PADDING * 2 - GAP * (BOARD_SIZE + 1)) / BOARD_SIZE);
const BOARD_WIDTH = TILE_SIZE * BOARD_SIZE + GAP * (BOARD_SIZE + 1) + BOARD_PADDING * 2 - BOARD_PADDING;

export function GameBoard() {
  const { board, move } = useGame();
  const swipeRef = useRef({ startX: 0, startY: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: (_, g) => {
        swipeRef.current = { startX: g.x0, startY: g.y0 };
      },
      onPanResponderRelease: (_, g) => {
        const dx = g.moveX - swipeRef.current.startX;
        const dy = g.moveY - swipeRef.current.startY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 20) return;

        if (absDx > absDy) {
          move(dx > 0 ? 'right' : 'left');
        } else {
          move(dy > 0 ? 'down' : 'up');
        }
      },
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Empty cell grid */}
      {Array(BOARD_SIZE).fill(null).map((_, r) => (
        Array(BOARD_SIZE).fill(null).map((_, c) => (
          <View
            key={`empty_${r}_${c}`}
            style={[
              styles.emptyCell,
              {
                width: TILE_SIZE,
                height: TILE_SIZE,
                left: GAP + c * (TILE_SIZE + GAP),
                top: GAP + r * (TILE_SIZE + GAP),
              }
            ]}
          />
        ))
      ))}

      {/* Tiles */}
      {board.map(row =>
        row.map(tile =>
          tile ? (
            <GameTile key={tile.id} tile={tile} tileSize={TILE_SIZE} gap={GAP} />
          ) : null
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: BOARD_WIDTH,
    height: BOARD_WIDTH,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'center',
  },
  emptyCell: {
    position: 'absolute',
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    opacity: 0.6,
  },
});
