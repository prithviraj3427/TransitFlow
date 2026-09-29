package com.example.train;

public class Station {
    private String name;
    private String scheduledArrival;
    private String scheduledDeparture;
    private String predictedETA;
    private String predictedETD;
    private String platform;
    private String delayCause;
    private boolean isCompleted;

    public Station(String name, String scheduledArrival, String scheduledDeparture,
                   String predictedETA, String predictedETD, String platform,
                   String delayCause, boolean isCompleted) {
        this.name = name;
        this.scheduledArrival = scheduledArrival;
        this.scheduledDeparture = scheduledDeparture;
        this.predictedETA = predictedETA;
        this.predictedETD = predictedETD;
        this.platform = platform;
        this.delayCause = delayCause;
        this.isCompleted = isCompleted;
    }

    public String getName() { return name; }
    public String getScheduledArrival() { return scheduledArrival; }
    public String getScheduledDeparture() { return scheduledDeparture; }
    public String getPredictedETA() { return predictedETA; }
    public String getPredictedETD() { return predictedETD; }
    public String getPlatform() { return platform; }
    public String getDelayCause() { return delayCause; }
    public boolean isCompleted() { return isCompleted; }
}