package com.example.train;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityComparisonBinding;

public class ComparisonActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityComparisonBinding binding = ActivityComparisonBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarComp);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarComp.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        AnimationUtils.entranceFadeIn(binding.cardComparisonTable, 200);
        AnimationUtils.entranceFadeIn(binding.cardResearchLinks, 400);
    }
}