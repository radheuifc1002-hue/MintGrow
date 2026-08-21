import React, { useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, PanResponder, Text, Platform } from 'react-native';
import { useGame } from '@/hooks/useGame';
import { GameTile } from './GameTile';
import { Radius, Typography } from '@/constants/theme';

const BOARD_SIZE = 4;
const GAP = 10;

function getBoardMetrics(width: number, height: number) {
  // Geometry follows the approved 781px reference: the board occupies about 86% of width.
  // The height limit prevents it from colliding with Telegram's bottom navigation.
  const widthLimit = Math.max(286, width - 70);
  const heightLimit = Math.max(286, height * 0.50);
  const boardW = Math.min(widthLimit, heightLimit, 660);
  const tileSize = Math.max(54, Math.floor((boardW - GAP * (BOARD_SIZE + 1)) / BOARD_SIZE));
  const boardDim = tileSize * BOARD_SIZE + GAP * (BOARD_SIZE + 1);
  return { tileSize, boardDim };
}

export function GameBoard() {
  const { board, move } = useGame();
  const { width, height } = useWindowDimensions();
  const { tileSize, boardDim } = getBoardMetrics(width, height);
  const swipeStart = useRef({ x: 0, y: 0 });

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderGrant: (_, g) => { swipeStart.current = { x: g.x0, y: g.y0 }; },
    onPanResponderRelease: (_, g) => {
      const dx = g.moveX - swipeStart.current.x;
      const dy = g.moveY - swipeStart.current.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    },
  })).current;

  return (
    <View style={[styles.frame, { width: boardDim + 14 }]}>
      <View style={styles.topRail} pointerEvents="none">
        <View style={styles.railTitle}><View style={styles.railMark} /><Text style={styles.railText}>SWIPE TO MERGE</Text></View>
        <View style={styles.railDot} />
      </View>
      <View style={[styles.container, { width: boardDim, height: boardDim }, Platform.OS === 'web' && ({ touchAction: 'none', userSelect: 'none' } as any)]} {...panResponder.panHandlers}>
        {Array(BOARD_SIZE).fill(null).map((_, r) => Array(BOARD_SIZE).fill(null).map((_, c) => (
          <View key={`e_${r}_${c}`} style={[styles.emptyCell, { width: tileSize, height: tileSize, left: GAP + c * (tileSize + GAP), top: GAP + r * (tileSize + GAP) }]} />
        )))}
        {board.map(row => row.map(tile => tile ? <GameTile key={tile.id} tile={tile} tileSize={tileSize} gap={GAP} /> : null))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#062A1D', borderRadius: 30, padding: 7, borderWidth: 2, borderColor: '#20D99A', shadowColor: '#00A86B', shadowOpacity: 0.24, shadowRadius: 15, elevation: 8, alignSelf: 'center' },
  topRail: { height: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 7 },
  railTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, railMark: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#31EBAA' },
  railText: { ...Typography.caption, color: '#D4FFE8', letterSpacing: 1.05, fontWeight: '900' }, railDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#31EBAA' },
  container: { backgroundColor: '#0C3A2A', borderRadius: 21, position: 'relative', borderWidth: 1, borderColor: 'rgba(184,255,217,0.30)' },
  emptyCell: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(184,255,217,0.17)' },
});
