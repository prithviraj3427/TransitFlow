package com.example.train;

import java.util.ArrayList;
import java.util.List;

public class RailGathiEngine {

    public static class PlatformConflict {
        private String stationName;
        private String platform;
        private String train1;
        private String train2;
        private String conflictTime;
        private boolean isResolved;

        public PlatformConflict(String stationName, String platform, String train1, String train2, String conflictTime) {
            this.stationName = stationName;
            this.platform = platform;
            this.train1 = train1;
            this.train2 = train2;
            this.conflictTime = conflictTime;
            this.isResolved = false;
        }

        public String getStationName() { return stationName; }
        public String getPlatform() { return platform; }
        public String getTrain1() { return train1; }
        public String getTrain2() { return train2; }
        public String getConflictTime() { return conflictTime; }
        public boolean isResolved() { return isResolved; }
        public void setResolved(boolean resolved) { isResolved = resolved; }
        public void setPlatform(String newPlatform) { this.platform = newPlatform; }
    }

    public static class DelayCause {
        private String icon;
        private String title;
        private int minutesAdded;

        public DelayCause(String icon, String title, int minutesAdded) {
            this.icon = icon;
            this.title = title;
            this.minutesAdded = minutesAdded;
        }

        public String getIcon() { return icon; }
        public String getTitle() { return title; }
        public int getMinutesAdded() { return minutesAdded; }
    }

    private static List<PlatformConflict> activeConflicts = new ArrayList<>();

    static {
        // Initial simulated conflict for Vadodara Jn as in SIH slides
        activeConflicts.add(new PlatformConflict(
                "Vadodara Jn",
                "PF 3",
                "Express 12004 (Delhi-Mumbai)",
                "Rajdhani 12952 (August Kranti)",
                "17:25 - 17:35"
        ));
    }

    public static List<PlatformConflict> getActiveConflicts() {
        List<PlatformConflict> unresolved = new ArrayList<>();
        for (PlatformConflict c : activeConflicts) {
            if (!c.isResolved()) {
                unresolved.add(c);
            }
        }
        return unresolved;
    }

    public static boolean resolveConflict(String stationName, String newPlatform) {
        for (PlatformConflict c : activeConflicts) {
            if (c.getStationName().equalsIgnoreCase(stationName) && !c.isResolved()) {
                c.setResolved(true);
                c.setPlatform(newPlatform);
                return true;
            }
        }
        return false;
    }

    /**
     * SIH Formula: Replaces static math with cause-based delay calculation
     */
    public static List<DelayCause> calculateDelayCauses(String weather, int congestionLevel, boolean signalHalt) {
        List<DelayCause> causes = new ArrayList<>();

        if ("RAIN".equalsIgnoreCase(weather)) {
            causes.add(new DelayCause("🌧️", "Heavy Rain Multiplier (x1.3)", 12));
        } else if ("FOG".equalsIgnoreCase(weather)) {
            causes.add(new DelayCause("🌫️", "Poor Visibility / Fog (x1.4)", 18));
        }

        if (congestionLevel > 5) {
            causes.add(new DelayCause("🛤️", "Track Congestion Density", congestionLevel * 2));
        }

        if (signalHalt) {
            causes.add(new DelayCause("🚦", "Signal Precedence Halt", 8));
        }

        return causes;
    }

    /**
     * Delay Propagation Forecast: Calculates how a delay cascades downstream
     */
    public static int predictPropagatedDelay(int initialDelayMinutes, int stationsDownstream) {
        // Recovery factor per station if route has buffer
        double recoveryPerStation = 1.5;
        int predicted = (int) Math.max(0, initialDelayMinutes - (stationsDownstream * recoveryPerStation));
        return predicted;
    }
}