
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, X, MapPin, Vote, Crown } from "lucide-react";
import confetti from "canvas-confetti";

export default function WinCelebration({ wins, positionLabel, onDismiss }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!show) return;
    const end = Date.now() + 4000;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors: ["#f59e0b", "#fbbf24", "#fde047", "#f97316"] });
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors: ["#f59e0b", "#fbbf24", "#fde047", "#f97316"] });
      confetti({ particleCount: 3, angle: 90, spread: 120, origin: { x: 0.5, y: 0 }, colors: ["#f59e0b", "#fbbf24", "#fde047"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [show]);

  function handleDismiss() {
    setShow(false);
    setTimeout(() => onDismiss?.(), 300);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.5 }}
            onClick={e => e.stopPropagation()}
            className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-3xl p-6 max-w-sm w-full border-2 border-red-500/50 shadow-2xl shadow-red-500/20"
          >
            <button onClick={handleDismiss} className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
              className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40"
            >
              <Award className="w-12 h-12 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-1"
            >
              VICTORY!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm text-center text-zinc-400 mb-4"
            >
              You won the election! 🎉
            </motion.p>

            {wins.map((w, i) => (
              <motion.div
                key={w.id || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="bg-zinc-800/50 rounded-xl p-3 mb-2 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-white font-medium">{w.constituency}{w.seat_type && w.seat_type !== 'general' ? ` · ${w.seat_type}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Vote className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300">{(w.votes_received || 0).toLocaleString()} votes</span>
                </div>
                {positionLabel && (
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-sm text-amber-400 font-semibold">{positionLabel}</span>
                  </div>
                )}
                <p className="text-xs text-zinc-500">{w.party_name}</p>
              </motion.div>
            ))}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              onClick={handleDismiss}
              className="w-full mt-4 bg-gradient-to-r from-red-500 to-yellow-500 text-white font-bold py-3 rounded-xl text-sm hover:shadow-lg hover:shadow-red-500/30 transition-all"
            >
              Celebrate & Continue 🎉
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}