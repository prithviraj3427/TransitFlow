package com.example.train;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityTrackingDetailBinding;
import com.example.train.databinding.ItemTimelineBinding;
import java.util.ArrayList;
import java.util.List;

public class TrackingDetailActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        // Immersive UI
        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityTrackingDetailBinding binding = ActivityTrackingDetailBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarTracking);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarTracking.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        // Entrance Animations
        AnimationUtils.entranceFadeIn(binding.velocityCore, 200);
        AnimationUtils.entranceFadeIn(binding.neuralTimelineContainer, 400);

        populateTimeline(binding);
    }

    private void populateTimeline(ActivityTrackingDetailBinding binding) {
        List<Station> stations = new ArrayList<>();
        stations.add(new Station("New Delhi", "06:00", "06:00", "ETA 06:00", "ETD 06:00", "PF 1", "On Time", true));
        stations.add(new Station("Mathura Jn", "07:30", "07:35", "ETA 07:35", "ETD 07:40", "PF 3", "🌧️ Rain Multiplier (x1.3)", true));
        stations.add(new Station("Kota Jn", "10:15", "10:25", "ETA 10:35", "ETD 10:45", "PF 2", "🛤️ Track Congestion (+10m)", false));
        stations.add(new Station("Ratlam Jn", "13:40", "13:50", "ETA 13:55", "ETD 14:05", "PF 1", "🚦 Signal Precedence (+8m)", false));
        stations.add(new Station("Vadodara Jn", "17:20", "17:35", "ETA 17:35", "ETD 17:48", "PF 4", "⚠️ Platform Clash Resolved (PF 4)", false));
        stations.add(new Station("Mumbai Central", "21:30", "21:30", "ETA 21:40", "ETD Terminus", "PF 6", "Cascading Delay Propagation (+10m)", false));

        LayoutInflater inflater = LayoutInflater.from(this);
        for (Station station : stations) {
            ItemTimelineBinding itemBinding = ItemTimelineBinding.inflate(inflater, binding.timelineItemsContainer, false);

            itemBinding.textStationName.setText(station.getName());
            itemBinding.textTimes.setText(String.format("Sch: %s/%s | %s | %s",
                    station.getScheduledArrival(), station.getScheduledDeparture(),
                    station.getPredictedETA(), station.getPredictedETD()));
            itemBinding.textCausePill.setText(station.getDelayCause());
            itemBinding.textPlatform.setText(station.getPlatform());

            if (station.isCompleted()) {
                itemBinding.nodeIndicator.setBackgroundResource(R.drawable.glass_button_primary);
                itemBinding.textStationName.setAlpha(0.6f);
                itemBinding.textTimes.setAlpha(0.6f);
            } else {
                itemBinding.nodeIndicator.setBackgroundResource(R.drawable.glass_input_background);
            }

            binding.timelineItemsContainer.addView(itemBinding.getRoot());
        }
    }
}