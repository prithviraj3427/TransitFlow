package com.example.train;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityStationMasterBinding;

public class StationMasterActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        // Immersive UI
        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityStationMasterBinding binding = ActivityStationMasterBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarStaff);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarStaff.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        // Entrance Animations
        AnimationUtils.entranceFadeIn(binding.cardConflictAlert, 200);

        // Resolve Conflict Action
        binding.buttonReassignPf.setOnClickListener(v -> {
            boolean success = RailGathiEngine.resolveConflict("Vadodara Jn", "PF 4");
            if (success) {
                binding.textConflictStatus.setText("✅ CONFLICT RESOLVED");
                binding.textConflictDetails.setText("Express 12004 successfully re-assigned to PF 4. Conflict cleared across network.");
                binding.buttonReassignPf.setEnabled(false);
                binding.buttonReassignPf.setText("Platform 4 Allocated");
                Toast.makeText(this, "Conflict Resolved & Pushed to Passenger Feeds!", Toast.LENGTH_LONG).show();
            }
        });

        // Event Injectors
        binding.btnInjectRain.setOnClickListener(v ->
            Toast.makeText(this, "Event Injected: Heavy Rain multiplier (x1.3) applied to Kota zone", Toast.LENGTH_SHORT).show()
        );

        binding.btnInjectSignal.setOnClickListener(v ->
            Toast.makeText(this, "Event Injected: Signal Halt (+8m) pushed to downstream ETA engine", Toast.LENGTH_SHORT).show()
        );

        // Touch Feedback
        AnimationUtils.applyLiquidTouch(binding.buttonReassignPf);
        AnimationUtils.applyLiquidTouch(binding.btnInjectRain);
        AnimationUtils.applyLiquidTouch(binding.btnInjectSignal);
    }
}