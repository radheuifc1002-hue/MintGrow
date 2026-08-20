import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Text } from 'react-native';
import { useGame } from '@/hooks/useGame';
import { GameTile } from './GameTile';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

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
    <View style={styles.frame}>
      <View style={styles.topRail}>
        <Text style={styles.railText}>Swipe to merge</Text>
        <View style={styles.liveDot} />
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#09291D',
    borderRadius: Radius.xl,
    padding: Spacing.sm,
    borderWidth: 2,
    borderColor: '#1DE89B',
    shadowColor: Colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  topRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  railText: { ...Typography.caption, color: '#B8FFD9', letterSpacing: 1.2, textTransform: 'uppercase' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#23F0A7' },
  container: {
    backgroundColor: '#103D2C',
    borderRadius: Radius.lg,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(184,255,217,0.35)',
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyCell: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(184,255,217,0.18)',
  },
});
