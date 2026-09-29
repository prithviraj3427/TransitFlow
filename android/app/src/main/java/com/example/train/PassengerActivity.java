package com.example.train;

import android.content.Intent;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityPassengerBinding;
import java.util.List;

public class PassengerActivity extends AppCompatActivity {

    private ActivityPassengerBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        // Immersive UI
        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        binding = ActivityPassengerBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarPassenger);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarPassenger.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        // Apply Entrance Animations (Full Experience Wave)
        AnimationUtils.entranceFadeIn(binding.cardActiveJourney, 200);
        AnimationUtils.entranceFadeIn(binding.cardClashAlert, 300);
        AnimationUtils.entranceFadeIn(binding.cardChronoLink, 400);
        AnimationUtils.entranceFadeIn(binding.cardNeuralPass, 600);
        AnimationUtils.entranceFadeIn(binding.cardHydroPantry, 800);
        AnimationUtils.entranceFadeIn(binding.cardBenchmarkMatrix, 1000);

        // Link 1: Chrono-Link to Live Tracking
        binding.cardChronoLink.setOnClickListener(v -> {
            Intent intent = new Intent(this, TrackingDetailActivity.class);
            startActivity(intent);
        });

        // Link 2: Neural-Pass to Digital Ticket
        binding.cardNeuralPass.setOnClickListener(v -> {
            Intent intent = new Intent(this, TicketDetailActivity.class);
            startActivity(intent);
        });

        // Link 3: Hydro-Pantry to In-Seat Dining
        binding.cardHydroPantry.setOnClickListener(v -> {
            Intent intent = new Intent(this, FoodPantryActivity.class);
            startActivity(intent);
        });

        // Link 4: Benchmark Matrix to System Comparison
        binding.cardBenchmarkMatrix.setOnClickListener(v -> {
            Intent intent = new Intent(this, ComparisonActivity.class);
            startActivity(intent);
        });

        // Link Active Journey Card to Live Tracking
        binding.cardActiveJourney.setOnClickListener(v -> {
            Intent intent = new Intent(this, TrackingDetailActivity.class);
            startActivity(intent);
        });

        // Link Platform Clash Alert to Station Master Control Room view
        binding.cardClashAlert.setOnClickListener(v -> {
            Intent intent = new Intent(this, StationMasterActivity.class);
            startActivity(intent);
        });

        // Apply Liquid Touch Feedback to all modules AFTER click listeners
        AnimationUtils.applyLiquidTouch(binding.cardActiveJourney);
        AnimationUtils.applyLiquidTouch(binding.cardClashAlert);
        AnimationUtils.applyLiquidTouch(binding.cardChronoLink);
        AnimationUtils.applyLiquidTouch(binding.cardNeuralPass);
        AnimationUtils.applyLiquidTouch(binding.cardHydroPantry);
        AnimationUtils.applyLiquidTouch(binding.cardBenchmarkMatrix);

        updatePlatformConflictStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updatePlatformConflictStatus();
    }

    private void updatePlatformConflictStatus() {
        if (binding == null) return;
        List<RailGathiEngine.PlatformConflict> conflicts = RailGathiEngine.getActiveConflicts();
        if (conflicts.isEmpty()) {
            binding.textPlatformClashBadge.setText("✅ Platform Conflict Engine: All Platform Assignments Clear");
        } else {
            RailGathiEngine.PlatformConflict c = conflicts.get(0);
            binding.textPlatformClashBadge.setText(String.format("⚠️ Platform Clash Alert: %s (%s) - Tap to Resolve", c.getStationName(), c.getPlatform()));
        }
    }
}