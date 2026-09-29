package com.example.train;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityPropagationBinding;

public class PropagationActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityPropagationBinding binding = ActivityPropagationBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarProp);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarProp.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        AnimationUtils.entranceFadeIn(binding.cardInitialCause, 200);
        AnimationUtils.entranceFadeIn(binding.cardDownstreamImpact, 400);
    }
}