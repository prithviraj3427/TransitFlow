package com.example.train;

import android.content.Intent;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityLoginBinding;

public class LoginActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        // Immersive UI
        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityLoginBinding binding = ActivityLoginBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        // Entrance Animations
        AnimationUtils.entranceFadeIn(binding.loginContainer, 300);

        // Enter Passenger Mode
        binding.btnPassengerMode.setOnClickListener(v -> {
            Intent intent = new Intent(this, PassengerActivity.class);
            startActivity(intent);
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        });

        // Enter Station Master Control Room Mode
        binding.btnStaffMode.setOnClickListener(v -> {
            Intent intent = new Intent(this, StationMasterActivity.class);
            startActivity(intent);
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        });

        // View SIH Benchmark Comparison
        binding.btnBenchmarkMatrix.setOnClickListener(v -> {
            Intent intent = new Intent(this, ComparisonActivity.class);
            startActivity(intent);
        });

        // Liquid Touch Feedback
        AnimationUtils.applyLiquidTouch(binding.btnPassengerMode);
        AnimationUtils.applyLiquidTouch(binding.btnStaffMode);
        AnimationUtils.applyLiquidTouch(binding.btnBenchmarkMatrix);
    }
}