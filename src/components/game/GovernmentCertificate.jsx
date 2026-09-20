
import React from "react";
import { motion } from "framer-motion";
import { Landmark, Crown, User, MapPin, CheckCircle2, ShieldCheck } from "lucide-react";

export default function GovernmentCertificate({ partyName, seats, majorityMark, isAlliance, coalitionParties, leaderName, leaderConstituency, onDismiss }) {
  const hasMajority = seats >= majorityMark;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.7, bounce: 0.3 }}
        onClick={e => e.stopPropagation()}
        className="relative max-w-sm w-full"
      >
        {/* Outer ornate frame */}
        <div className="bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 rounded-2xl p-1 border-2 border-amber-800 shadow-2xl shadow-amber-900/40">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border-2 border-amber-700/40">
            {/* Top emblem band */}
            <div className="flex items-center justify-center gap-3 mb-4 pb-3 border-b-2 border-amber-700/40">
              <ShieldCheck className="w-7 h-7 text-amber-800" />
              <div className="text-center">
                <p className="text-[10px] font-bold text-amber-900 uppercase tracking-[0.15em]">Election Commission of Tamil Nadu</p>
                <p className="text-[8px] text-amber-700/80 uppercase tracking-widest">Official Government Certificate</p>
              </div>
              <ShieldCheck className="w-7 h-7 text-amber-800" />
            </div>

            {/* Central seal */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                className="relative w-24 h-24"
              >
                <div className="absolute inset-0 rounded-full border-4 border-double border-amber-800"></div>
                <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center">
                  <Crown className="w-11 h-11 text-amber-900" />
                </div>
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center text-xl font-bold text-amber-900 mb-1"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Certificate of Majority
            </motion.h2>
            <p className="text-center text-[11px] text-amber-800 uppercase tracking-wider mb-4">
              Government Formation Confirmed
            </p>

            {/* Body */}
            <div className="text-center mb-4 space-y-3">
              <div>
                <p className="text-[11px] text-amber-700 uppercase tracking-wide mb-1">Ruling Party / Alliance</p>
                <p className="text-lg font-bold text-amber-950">{partyName}</p>
                {isAlliance && coalitionParties?.length > 0 && (
                  <p className="text-[10px] text-amber-700 mt-0.5">Coalition: {coalitionParties.join(" · ")}</p>
                )}
              </div>

              {leaderName && (
                <div className="bg-amber-100/60 rounded-lg py-2 px-3 border border-amber-700/30">
                  <p className="text-[10px] text-amber-700 uppercase tracking-wide mb-0.5 flex items-center justify-center gap-1">
                    <User className="w-3 h-3" /> Elected Leader (Chief Minister)
                  </p>
                  <p className="text-base font-bold text-amber-950">{leaderName}</p>
                  {leaderConstituency && (
                    <p className="text-[10px] text-amber-700 flex items-center justify-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" /> MLA, {leaderConstituency}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-950">{seats}</p>
                  <p className="text-[9px] text-amber-700 uppercase">Seats Won</p>
                </div>
                <div className="w-px h-8 bg-amber-700/40" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-950">{majorityMark}</p>
                  <p className="text-[9px] text-amber-700 uppercase">Majority Mark</p>
                </div>
              </div>
            </div>

            {/* Confirmation badge */}
            {hasMajority && (
              <div className="flex items-center justify-center gap-1.5 text-green-800 mb-4">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Absolute Majority Achieved</span>
              </div>
            )}

            {/* Signature line */}
            <div className="border-t border-amber-700/40 pt-3 flex items-end justify-between">
              <div className="text-left">
                <p className="text-[10px] text-amber-700/70">Date of Declaration</p>
                <p className="text-xs font-semibold text-amber-900">
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <div className="border-t border-amber-800/60 mt-3 w-24" />
                <p className="text-[9px] text-amber-700 mt-0.5">Chief Election Commissioner</p>
              </div>
              <div className="text-right">
                <div className="w-16 h-16 rounded-full border-2 border-amber-800 flex items-center justify-center bg-amber-50">
                  <Landmark className="w-8 h-8 text-amber-800" />
                </div>
                <p className="text-[9px] text-amber-700 mt-1 italic">TV99 Tamil Nadu</p>
              </div>
            </div>

            {/* Continue button */}
            <button
              onClick={onDismiss}
              className="w-full mt-4 bg-gradient-to-r from-amber-700 to-amber-900 text-amber-50 font-bold py-3 rounded-xl text-sm hover:shadow-lg hover:shadow-amber-900/30 transition-all"
            >
              Continue →
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}