import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { useGame } from '@/hooks/useGame';
import { GameTile } from './GameTile';
import { Colors, Radius } from '@/constants/theme';

const BOARD_SIZE = 4;
const GAP = 8;

function getBoardMetrics() {
  const { width, height } = Dimensions.get('window');
  // Use the smaller dimension to keep board square and fitting
  const maxFromWidth = width - 32;
  const maxFromHeight = height * 0.48;
  const boardW = Math.min(maxFromWidth, maxFromHeight, 380);
  const tileSize = Math.floor((boardW - GAP * (BOARD_SIZE + 1)) / BOARD_SIZE);
  const boardDim = tileSize * BOARD_SIZE + GAP * (BOARD_SIZE + 1);
  return { tileSize: Math.max(tileSize, 60), boardDim };
}

export function GameBoard() {
  const { board, move } = useGame();
  const { tileSize, boardDim } = getBoardMetrics();
  const swipeStart = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: (_, g) => {
        swipeStart.current = { x: g.x0, y: g.y0 };
      },
      onPanResponderRelease: (_, g) => {
        const dx = g.moveX - swipeStart.current.x;
        const dy = g.moveY - swipeStart.current.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (Math.max(absDx, absDy) < 20) return;
        if (absDx > absDy) move(dx > 0 ? 'right' : 'left');
        else move(dy > 0 ? 'down' : 'up');
      },
    })
  ).current;

  return (
    <View
      style={[styles.container, { width: boardDim, height: boardDim }]}
      {...panResponder.panHandlers}
    >
      {/* Empty cells */}
      {Array(BOARD_SIZE).fill(null).map((_, r) =>
        Array(BOARD_SIZE).fill(null).map((_, c) => (
          <View
            key={`e_${r}_${c}`}
            style={[
              styles.emptyCell,
              {
                width: tileSize,
                height: tileSize,
                left: GAP + c * (tileSize + GAP),
                top: GAP + r * (tileSize + GAP),
              },
            ]}
          />
        ))
      )}

      {/* Tiles */}
      {board.map(row =>
        row.map(tile =>
          tile ? <GameTile key={tile.id} tile={tile} tileSize={tileSize} gap={GAP} /> : null
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyCell: {
    position: 'absolute',
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
