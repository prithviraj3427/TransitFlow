package com.example.train;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.example.train.databinding.ActivityFoodPantryBinding;

public class FoodPantryActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        ThemeSelector.applyTheme(this);
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.setFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        ActivityFoodPantryBinding binding = ActivityFoodPantryBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setSupportActionBar(binding.toolbarPantry);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }

        binding.toolbarPantry.setNavigationOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());

        AnimationUtils.entranceFadeIn(binding.cardFood1, 200);
        AnimationUtils.entranceFadeIn(binding.cardFood2, 400);

        binding.btnOrderFood1.setOnClickListener(v ->
            Toast.makeText(this, "Order Placed! Executive Thali will be delivered at Kota Jn (PF 2)", Toast.LENGTH_LONG).show()
        );

        binding.btnOrderFood2.setOnClickListener(v ->
            Toast.makeText(this, "Order Placed! Express Beverage will be served to Coach B3 - Seat 42", Toast.LENGTH_LONG).show()
        );

        AnimationUtils.applyLiquidTouch(binding.btnOrderFood1);
        AnimationUtils.applyLiquidTouch(binding.btnOrderFood2);
    }
}